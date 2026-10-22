package address

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/toko-online/internal/auth"
	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

const (
	maxAddresses = 10
	defaultLabel = "Alamat"
)

var (
	phoneRegex  = regexp.MustCompile(`^(?:\+62|62|0)8\d{8,11}$`)
	postalRegex = regexp.MustCompile(`^\d{5}$`)

	ErrNotFound = errors.New("not found")
	ErrLimit    = errors.New("address limit reached")
)

// ---------- Tipe ----------

type Address struct {
	ID            string `json:"id"`
	Label         string `json:"label"`
	RecipientName string `json:"recipient_name"`
	Phone         string `json:"phone"`
	Address       string `json:"address"`
	District      string `json:"district"`
	City          string `json:"city"`
	Province      string `json:"province"`
	PostalCode    string `json:"postal_code"`
	IsDefault     bool   `json:"is_default"`
}

type input struct {
	Label         string `json:"label"`
	RecipientName string `json:"recipient_name"`
	Phone         string `json:"phone"`
	Address       string `json:"address"`
	District      string `json:"district"`
	City          string `json:"city"`
	Province      string `json:"province"`
	PostalCode    string `json:"postal_code"`
	IsDefault     bool   `json:"is_default"`
}

func (in *input) normalize() {
	in.Label = strings.TrimSpace(in.Label)
	if in.Label == "" {
		in.Label = defaultLabel
	}
	in.RecipientName = strings.TrimSpace(in.RecipientName)
	in.Phone = strings.NewReplacer(" ", "", "-", "").Replace(in.Phone)
	in.Address = strings.TrimSpace(in.Address)
	in.District = strings.TrimSpace(in.District)
	in.City = strings.TrimSpace(in.City)
	in.Province = strings.TrimSpace(in.Province)
	in.PostalCode = strings.TrimSpace(in.PostalCode)
}

func between(s string, min, max int) bool {
	n := utf8.RuneCountInString(s)
	return n >= min && n <= max
}

func (in input) validate() map[string]interface{} {
	d := map[string]interface{}{}

	if !between(in.Label, 1, 100) {
		d["label"] = "Label maksimal 100 karakter"
	}
	if !between(in.RecipientName, 2, 255) {
		d["recipient_name"] = "Nama penerima 2 sampai 255 karakter"
	}
	if !phoneRegex.MatchString(in.Phone) {
		d["phone"] = "Gunakan nomor HP Indonesia, contoh 081234567890"
	}
	if !between(in.Address, 5, 500) {
		d["address"] = "Alamat lengkap 5 sampai 500 karakter"
	}
	if !between(in.District, 2, 100) {
		d["district"] = "Kecamatan wajib diisi"
	}
	if !between(in.City, 2, 100) {
		d["city"] = "Kota wajib diisi"
	}
	if !between(in.Province, 2, 100) {
		d["province"] = "Provinsi wajib diisi"
	}
	if !postalRegex.MatchString(in.PostalCode) {
		d["postal_code"] = "Kode pos harus 5 angka"
	}
	return d
}

// ---------- Store ----------

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

const addressColumns = `id::text, label, recipient, phone, street, district, city, province, postal_code, is_default`

func scanAddress(row pgx.Row) (*Address, error) {
	var a Address
	err := row.Scan(&a.ID, &a.Label, &a.RecipientName, &a.Phone, &a.Address,
		&a.District, &a.City, &a.Province, &a.PostalCode, &a.IsDefault)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// lockUser mengunci baris user selama transaksi supaya dua permintaan bersamaan
// (mis. klik dua kali) tidak membuat dua alamat utama atau melewati batas jumlah.
func lockUser(ctx context.Context, tx pgx.Tx, userID string) error {
	var id string
	err := tx.QueryRow(ctx, `SELECT id::text FROM users WHERE id = $1::uuid FOR UPDATE`, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Store) List(ctx context.Context, userID string) ([]Address, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+addressColumns+` FROM addresses
		 WHERE user_id = $1::uuid
		 ORDER BY is_default DESC, created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Address, 0)
	for rows.Next() {
		a, err := scanAddress(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *a)
	}
	return items, rows.Err()
}

func (s *Store) Create(ctx context.Context, userID string, in input) (*Address, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := lockUser(ctx, tx, userID); err != nil {
		return nil, err
	}

	var count int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM addresses WHERE user_id = $1::uuid`, userID).Scan(&count); err != nil {
		return nil, err
	}
	if count >= maxAddresses {
		return nil, ErrLimit
	}

	// Alamat pertama otomatis menjadi alamat utama
	isDefault := in.IsDefault || count == 0
	if isDefault {
		if _, err := tx.Exec(ctx,
			`UPDATE addresses SET is_default = FALSE, updated_at = NOW()
			 WHERE user_id = $1::uuid AND is_default`, userID); err != nil {
			return nil, err
		}
	}

	a, err := scanAddress(tx.QueryRow(ctx, `
		INSERT INTO addresses
		  (user_id, label, recipient, phone, street, district, city, province, postal_code, is_default)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+addressColumns,
		userID, in.Label, in.RecipientName, in.Phone, in.Address,
		in.District, in.City, in.Province, in.PostalCode, isDefault))
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Store) Update(ctx context.Context, userID, id string, in input) (*Address, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := lockUser(ctx, tx, userID); err != nil {
		return nil, err
	}

	if in.IsDefault {
		if _, err := tx.Exec(ctx,
			`UPDATE addresses SET is_default = FALSE, updated_at = NOW()
			 WHERE user_id = $1::uuid AND id <> $2::uuid AND is_default`, userID, id); err != nil {
			return nil, err
		}
	}

	// Alamat utama tidak bisa "dicabut" lewat ubah; ganti dengan menjadikan alamat lain utama
	a, err := scanAddress(tx.QueryRow(ctx, `
		UPDATE addresses
		SET label = $3, recipient = $4, phone = $5, street = $6, district = $7,
		    city = $8, province = $9, postal_code = $10,
		    is_default = is_default OR $11::boolean,
		    updated_at = NOW()
		WHERE id = $1::uuid AND user_id = $2::uuid
		RETURNING `+addressColumns,
		id, userID, in.Label, in.RecipientName, in.Phone, in.Address,
		in.District, in.City, in.Province, in.PostalCode, in.IsDefault))
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Store) Delete(ctx context.Context, userID, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := lockUser(ctx, tx, userID); err != nil {
		return err
	}

	var wasDefault bool
	err = tx.QueryRow(ctx,
		`DELETE FROM addresses WHERE id = $1::uuid AND user_id = $2::uuid RETURNING is_default`,
		id, userID).Scan(&wasDefault)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	// Jika yang dihapus alamat utama, alamat terbaru yang tersisa menjadi utama
	if wasDefault {
		if _, err := tx.Exec(ctx, `
			UPDATE addresses SET is_default = TRUE, updated_at = NOW()
			WHERE id = (
			  SELECT id FROM addresses WHERE user_id = $1::uuid
			  ORDER BY created_at DESC LIMIT 1
			)`, userID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (s *Store) SetDefault(ctx context.Context, userID, id string) (*Address, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := lockUser(ctx, tx, userID); err != nil {
		return nil, err
	}

	var exists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM addresses WHERE id = $1::uuid AND user_id = $2::uuid)`,
		id, userID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}

	if _, err := tx.Exec(ctx,
		`UPDATE addresses SET is_default = FALSE, updated_at = NOW()
		 WHERE user_id = $1::uuid AND is_default AND id <> $2::uuid`, userID, id); err != nil {
		return nil, err
	}

	a, err := scanAddress(tx.QueryRow(ctx,
		`UPDATE addresses SET is_default = TRUE, updated_at = NOW()
		 WHERE id = $1::uuid AND user_id = $2::uuid
		 RETURNING `+addressColumns, id, userID))
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return a, nil
}

// ---------- Handler ----------

type Handler struct {
	store *Store
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{store: NewStore(pool)}
}

// Mount memasang /addresses (wajib login) di router /api/v1.
func (h *Handler) Mount(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.Route("/addresses", func(r chi.Router) {
		r.Use(requireAuth)
		r.Get("/", h.List)
		r.Post("/", h.Create)
		r.Put("/{id}", h.Update)
		r.Delete("/{id}", h.Delete)
		r.Post("/{id}/default", h.SetDefault)
	})
}

func pathID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		errx.JSON(w, errx.NotFound("Alamat tidak ditemukan"))
		return "", false
	}
	return id, true
}

func readInput(w http.ResponseWriter, r *http.Request) (input, bool) {
	var in input
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		errx.JSON(w, errx.BadRequest("Body request tidak valid"))
		return in, false
	}
	in.normalize()
	if d := in.validate(); len(d) > 0 {
		errx.JSON(w, errx.ValidationError("Data yang dikirim tidak valid").WithDetails(d))
		return in, false
	}
	return in, true
}

func internalError(w http.ResponseWriter, action string, err error) {
	slog.Error("address: "+action, slog.Any("error", err))
	errx.JSON(w, errx.InternalServerError("Terjadi kesalahan pada server"))
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.store.List(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		internalError(w, "list", err)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	in, ok := readInput(w, r)
	if !ok {
		return
	}

	a, err := h.store.Create(r.Context(), auth.UserID(r.Context()), in)
	switch {
	case errors.Is(err, ErrLimit):
		errx.JSON(w, errx.Conflict("Maksimal 10 alamat. Hapus alamat lama untuk menambah yang baru."))
	case errors.Is(err, ErrNotFound):
		errx.JSON(w, errx.Unauthorized("Akun tidak ditemukan"))
	case err != nil:
		internalError(w, "create", err)
	default:
		response.JSON(w, http.StatusCreated, a, nil)
	}
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	in, ok := readInput(w, r)
	if !ok {
		return
	}

	a, err := h.store.Update(r.Context(), auth.UserID(r.Context()), id, in)
	switch {
	case errors.Is(err, ErrNotFound):
		errx.JSON(w, errx.NotFound("Alamat tidak ditemukan"))
	case err != nil:
		internalError(w, "update", err)
	default:
		response.JSON(w, http.StatusOK, a, nil)
	}
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	err := h.store.Delete(r.Context(), auth.UserID(r.Context()), id)
	switch {
	case errors.Is(err, ErrNotFound):
		errx.JSON(w, errx.NotFound("Alamat tidak ditemukan"))
	case err != nil:
		internalError(w, "delete", err)
	default:
		response.Empty(w, http.StatusNoContent)
	}
}

func (h *Handler) SetDefault(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	a, err := h.store.SetDefault(r.Context(), auth.UserID(r.Context()), id)
	switch {
	case errors.Is(err, ErrNotFound):
		errx.JSON(w, errx.NotFound("Alamat tidak ditemukan"))
	case err != nil:
		internalError(w, "set default", err)
	default:
		response.JSON(w, http.StatusOK, a, nil)
	}
}