package auth

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

const (
	refreshCookieName = "refresh_token"
	refreshCookiePath = "/api/v1/auth"

	bcryptCost     = 12
	minPasswordLen = 8
	maxPasswordLen = 72 // batas bcrypt

	// Refresh token yang baru saja dirotasi masih diterima selama jeda ini.
	// Mencegah logout palsu saat dua request refresh terkirim hampir bersamaan
	// (mis. React StrictMode di mode dev memanggil recoverSession dua kali).
	refreshGracePeriod = 10 * time.Second
)

var (
	emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	phoneRegex = regexp.MustCompile(`^(?:\+62|62|0)8\d{8,11}$`)

	// Hash palsu untuk menyamakan waktu respons saat email tidak ditemukan
	dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password"), bcryptCost)
)

type Handler struct {
	store        *Store
	tokens       *TokenManager
	refreshTTL   time.Duration
	secureCookie bool
}

func NewHandler(store *Store, tokens *TokenManager, refreshTTL time.Duration, secureCookie bool) *Handler {
	return &Handler{
		store:        store,
		tokens:       tokens,
		refreshTTL:   refreshTTL,
		secureCookie: secureCookie,
	}
}

// Mount memasang route di router yang sudah berada di bawah /api/v1.
func (h *Handler) Mount(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.Post("/refresh", h.Refresh)
		r.Post("/logout", h.Logout)
	})
	r.With(requireAuth).Get("/me", h.Me)
}

// ---------- Request / response ----------

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	AccessToken string `json:"access_token"`
	User        *User  `json:"user"`
}

// ---------- Handlers ----------

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if apiErr := decodeJSON(w, r, &req); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = strings.NewReplacer(" ", "", "-", "").Replace(req.Phone)

	if details := validateRegister(req); len(details) > 0 {
		errx.JSON(w, errx.ValidationError("Data yang dikirim tidak valid").WithDetails(details))
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		internalError(w, "hash password", err)
		return
	}

	user, err := h.store.CreateUser(r.Context(), req.Name, req.Email, req.Phone, string(hash))
	if errors.Is(err, ErrEmailTaken) {
		errx.JSON(w, errx.New("EMAIL_ALREADY_EXISTS", "Email sudah terdaftar", http.StatusConflict).
			WithDetails(map[string]interface{}{"email": "Email sudah terdaftar"}))
		return
	}
	if err != nil {
		internalError(w, "create user", err)
		return
	}

	access, err := h.issueSession(w, r, user)
	if err != nil {
		internalError(w, "issue session", err)
		return
	}

	response.JSON(w, http.StatusCreated, authResponse{AccessToken: access, User: user}, nil)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if apiErr := decodeJSON(w, r, &req); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		errx.JSON(w, errx.ValidationError("Email dan kata sandi wajib diisi"))
		return
	}

	invalid := errx.New("INVALID_CREDENTIALS", "Email atau kata sandi salah", http.StatusUnauthorized)

	user, err := h.store.GetUserByEmail(r.Context(), email)
	if errors.Is(err, ErrNotFound) {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		errx.JSON(w, invalid)
		return
	}
	if err != nil {
		internalError(w, "get user by email", err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		errx.JSON(w, invalid)
		return
	}

	access, err := h.issueSession(w, r, user)
	if err != nil {
		internalError(w, "issue session", err)
		return
	}

	response.JSON(w, http.StatusOK, authResponse{AccessToken: access, User: user}, nil)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil || cookie.Value == "" {
		errx.JSON(w, errx.Unauthorized("Sesi tidak ditemukan"))
		return
	}

	token, err := h.store.GetRefreshToken(r.Context(), HashToken(cookie.Value))
	if errors.Is(err, ErrNotFound) {
		h.clearRefreshCookie(w)
		errx.JSON(w, errx.Unauthorized("Sesi tidak valid"))
		return
	}
	if err != nil {
		internalError(w, "get refresh token", err)
		return
	}

	now := time.Now()
	if now.After(token.ExpiresAt) {
		h.clearRefreshCookie(w)
		errx.JSON(w, errx.Unauthorized("Sesi sudah berakhir"))
		return
	}
	if token.RevokedAt != nil && now.Sub(*token.RevokedAt) > refreshGracePeriod {
		h.clearRefreshCookie(w)
		errx.JSON(w, errx.Unauthorized("Sesi tidak valid"))
		return
	}

	user, err := h.store.GetUserByID(r.Context(), token.UserID)
	if err != nil {
		h.clearRefreshCookie(w)
		errx.JSON(w, errx.Unauthorized("Sesi tidak valid"))
		return
	}

	// Rotasi: token lama dicabut, token baru diterbitkan
	if token.RevokedAt == nil {
		if err := h.store.RevokeRefreshToken(r.Context(), token.ID); err != nil {
			internalError(w, "revoke refresh token", err)
			return
		}
	}

	access, err := h.issueSession(w, r, user)
	if err != nil {
		internalError(w, "issue session", err)
		return
	}

	// Frontend hanya membaca access_token dari respons refresh
	response.JSON(w, http.StatusOK, map[string]string{"access_token": access}, nil)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(refreshCookieName); err == nil && cookie.Value != "" {
		if err := h.store.RevokeRefreshTokenByHash(r.Context(), HashToken(cookie.Value)); err != nil {
			slog.Error("logout: revoke refresh token", slog.Any("error", err))
		}
	}
	h.clearRefreshCookie(w)
	response.Empty(w, http.StatusNoContent)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user, err := h.store.GetUserByID(r.Context(), UserID(r.Context()))
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.Unauthorized("Akun tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "get me", err)
		return
	}
	response.JSON(w, http.StatusOK, user, nil)
}

// ---------- Helpers ----------

func (h *Handler) issueSession(w http.ResponseWriter, r *http.Request, user *User) (string, error) {
	access, err := h.tokens.NewAccessToken(user.ID, user.Role)
	if err != nil {
		return "", err
	}

	raw, hash, err := NewRefreshToken()
	if err != nil {
		return "", err
	}

	expires := time.Now().Add(h.refreshTTL)
	if err := h.store.InsertRefreshToken(r.Context(), user.ID, hash, expires); err != nil {
		return "", err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    raw,
		Path:     refreshCookiePath,
		Expires:  expires,
		MaxAge:   int(h.refreshTTL.Seconds()),
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
	return access, nil
}

func (h *Handler) clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     refreshCookiePath,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

func validateRegister(req registerRequest) map[string]interface{} {
	d := map[string]interface{}{}

	if len([]rune(req.Name)) < 2 {
		d["name"] = "Nama minimal 2 karakter"
	} else if len([]rune(req.Name)) > 255 {
		d["name"] = "Nama terlalu panjang"
	}

	if !emailRegex.MatchString(req.Email) || len(req.Email) > 255 {
		d["email"] = "Format email tidak valid"
	}

	if !phoneRegex.MatchString(req.Phone) {
		d["phone"] = "Gunakan nomor HP Indonesia, contoh 081234567890"
	}

	switch {
	case len([]rune(req.Password)) < minPasswordLen:
		d["password"] = "Kata sandi minimal 8 karakter"
	case len(req.Password) > maxPasswordLen:
		d["password"] = "Kata sandi maksimal 72 karakter"
	}

	return d
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) *errx.APIError {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return errx.BadRequest("Body request tidak valid")
	}
	return nil
}

func internalError(w http.ResponseWriter, action string, err error) {
	slog.Error("auth: "+action, slog.Any("error", err))
	errx.JSON(w, errx.InternalServerError("Terjadi kesalahan pada server"))
}