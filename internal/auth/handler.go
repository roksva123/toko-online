package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
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

	// Masa berlaku token reset kata sandi
	passwordResetTTL = 30 * time.Minute
)

var (
	emailRegex = regexp.MustCompile(`^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$`)
	phoneRegex = regexp.MustCompile(`^(?:\\+62|62|0)8\\d{8,11}$`)

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
		r.Post("/forgot-password", h.ForgotPassword) // New route
		r.Post("/reset-password", h.ResetPassword)   // New route
	})
	r.With(requireAuth).Get("/me", h.Me)
	r.With(requireAuth).Patch("/me", h.UpdateProfile)
	r.With(requireAuth).Post("/me/password", h.ChangePassword)
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

type updateProfileRequest struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
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

// UpdateProfile mengubah nama dan nomor HP milik user yang sedang login.
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var req updateProfileRequest
	if apiErr := decodeJSON(w, r, &req); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Phone = strings.NewReplacer(" ", "", "-", "").Replace(req.Phone)

	d := map[string]interface{}{}
	if n := len([]rune(req.Name)); n < 2 || n > 255 {
		d["name"] = "Nama 2 sampai 255 karakter"
	}
	if !phoneRegex.MatchString(req.Phone) {
		d["phone"] = "Gunakan nomor HP Indonesia, contoh 081234567890"
	}
	if len(d) > 0 {
		errx.JSON(w, errx.ValidationError("Data yang dikirim tidak valid").WithDetails(d))
		return
	}

	user, err := h.store.UpdateUserProfile(r.Context(), UserID(r.Context()), req.Name, req.Phone)
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.Unauthorized("Akun tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "update profile", err)
		return
	}
	response.JSON(w, http.StatusOK, user, nil)
}

// ChangePassword mengganti kata sandi, mencabut semua sesi lama,
// lalu menerbitkan sesi baru untuk perangkat yang sedang dipakai.
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req changePasswordRequest
	if apiErr := decodeJSON(w, r, &req); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}

	d := map[string]interface{}{}
	if req.CurrentPassword == "" {
		d["current_password"] = "Kata sandi saat ini wajib diisi"
	}
	switch {
	case len([]rune(req.NewPassword)) < minPasswordLen:
		d["new_password"] = "Kata sandi baru minimal 8 karakter"
	case len(req.NewPassword) > maxPasswordLen:
		d["new_password"] = "Kata sandi baru maksimal 72 karakter"
	case req.NewPassword == req.CurrentPassword:
		d["new_password"] = "Kata sandi baru harus berbeda dari yang lama"
	}
	if len(d) > 0 {
		errx.JSON(w, errx.ValidationError("Data yang dikirim tidak valid").WithDetails(d))
		return
	}

	ctx := r.Context()
	user, err := h.store.GetUserByID(ctx, UserID(ctx))
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.Unauthorized("Akun tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "get user", err)
		return
	}

	// Sengaja bukan 401: respons 401 akan memicu refresh otomatis di frontend
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		errx.JSON(w, errx.ValidationError("Kata sandi saat ini salah").
			WithDetails(map[string]interface{}{"current_password": "Kata sandi saat ini salah"}))
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
	if err != nil {
		internalError(w, "hash password", err)
		return
	}
	if err := h.store.UpdatePasswordHash(ctx, user.ID, string(hash)); err != nil {
		internalError(w, "update password", err)
		return
	}
	if err := h.store.RevokeAllRefreshTokens(ctx, user.ID); err != nil {
		internalError(w, "revoke sessions", err)
		return
	}

	access, err := h.issueSession(w, r, user)
	if err != nil {
		internalError(w, "issue session", err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"access_token": access}, nil)
}

// ForgotPassword menangani permintaan reset kata sandi dengan mengirim email.
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotPasswordRequest
	if apiErr := decodeJSON(w, r, &req); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	d := map[string]interface{}{}
	if !emailRegex.MatchString(req.Email) || len(req.Email) > 255 {
		d["email"] = "Format email tidak valid"
	}
	if len(d) > 0 {
		errx.JSON(w, errx.ValidationError("Data yang dikirim tidak valid").WithDetails(d))
		return
	}

	// Dapatkan user, tapi jangan tampilkan error jika tidak ditemukan
	// untuk mencegah enumerasi email.
	user, err := h.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			slog.Info("forgot password: email not found, sending dummy response", slog.String("email", req.Email))
			response.Empty(w, http.StatusNoContent)
			return
		}
		internalError(w, "get user by email for password reset", err)
		return
	}

	// Hasilkan token reset kata sandi
	rawToken, tokenHash, err := NewPasswordResetToken()
	if err != nil {
		internalError(w, "generate password reset token", err)
		return
	}

	expiresAt := time.Now().Add(passwordResetTTL)
	err = h.store.InsertPasswordResetToken(r.Context(), user.ID, tokenHash, expiresAt)
	if err != nil {
		internalError(w, "insert password reset token", err)
		return
	}

	// TODO: Ganti dengan URL frontend yang sebenarnya dari config
	resetLink := fmt.Sprintf("http://localhost:3000/reset-password?token=%s", rawToken)
	sendPasswordResetEmail(user.Email, resetLink)

	response.Empty(w, http.StatusNoContent)
}

// ResetPassword menangani penggantian kata sandi dengan token reset.
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if apiErr := decodeJSON(w, r, &req); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}

	req.Token = strings.TrimSpace(req.Token)

	d := validatePasswordReset(req)
	if len(d) > 0 {
		errx.JSON(w, errx.ValidationError("Data yang dikirim tidak valid").WithDetails(d))
		return
	}

	tokenHash := HashToken(req.Token)
	resetToken, err := h.store.GetPasswordResetToken(r.Context(), tokenHash)
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.ValidationError("Token reset tidak valid atau sudah digunakan").
			WithDetails(map[string]interface{}{"token": "Token reset tidak valid atau sudah digunakan"}))
		return
	}
	if err != nil {
		internalError(w, "get password reset token", err)
		return
	}

	now := time.Now()
	if now.After(resetToken.ExpiresAt) || resetToken.UsedAt != nil {
		errx.JSON(w, errx.ValidationError("Token reset tidak valid atau sudah digunakan").
			WithDetails(map[string]interface{}{"token": "Token reset tidak valid atau sudah digunakan"}))
		return
	}

	user, err := h.store.GetUserByID(r.Context(), resetToken.UserID)
	if errors.Is(err, ErrNotFound) {
		internalError(w, "get user by id from reset token", errors.New("user not found for valid reset token"))
		errx.JSON(w, errx.InternalServerError("Terjadi kesalahan pada server"))
		return
	}
	if err != nil {
		internalError(w, "get user by id from reset token", err)
		return
	}

	// Hash kata sandi baru
	newPasswordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
	if err != nil {
		internalError(w, "hash new password for reset", err)
		return
	}

	// Update kata sandi user
	err = h.store.UpdatePasswordHash(r.Context(), user.ID, string(newPasswordHash))
	if err != nil {
		internalError(w, "update user password after reset", err)
		return
	}

	// Tandai token reset sebagai sudah digunakan
	err = h.store.UsePasswordResetToken(r.Context(), resetToken.ID)
	if err != nil {
		slog.Error("failed to mark password reset token as used", slog.Any("error", err), slog.String("token_id", resetToken.ID))
		// Lanjutkan saja, jangan sampai gagal karena gagal memperbarui token
	}

	// Cabut semua sesi lama user
	if err := h.store.RevokeAllRefreshTokens(r.Context(), user.ID); err != nil {
		slog.Error("failed to revoke all refresh tokens after password reset", slog.Any("error", err), slog.String("user_id", user.ID))
		// Lanjutkan saja, jangan sampai gagal karena gagal mencabut sesi
	}

	response.Empty(w, http.StatusNoContent)
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

func validatePasswordReset(req resetPasswordRequest) map[string]interface{} {
	d := map[string]interface{}{}

	if req.Token == "" {
		d["token"] = "Token reset wajib diisi"
	}

	switch {
	case len([]rune(req.NewPassword)) < minPasswordLen:
		d["new_password"] = "Kata sandi baru minimal 8 karakter"
	case len(req.NewPassword) > maxPasswordLen:
		d["new_password"] = "Kata sandi baru maksimal 72 karakter"
	}

	return d
}

func NewPasswordResetToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	return raw, HashToken(raw), nil
}

func sendPasswordResetEmail(email, resetLink string) {
	slog.Info("Password Reset Email Sent",
		slog.String("to", email),
		slog.String("subject", "Reset Kata Sandi Akun Toko Online Anda"),
		slog.String("body", fmt.Sprintf("Halo,\n\nUntuk mereset kata sandi Anda, klik tautan berikut:\n%s\n\nTautan ini akan kedaluwarsa dalam 30 menit.\n\nJika Anda tidak meminta reset kata sandi, harap abaikan email ini.\n\nSalam,\nTim Toko Online", resetLink)),
	)
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