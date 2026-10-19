package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/toko-online/internal/auth"
	errx "github.com/example/toko-online/internal/httpx/error"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

type Handler struct {
	store *Store
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{store: NewStore(pool)}
}

// MountAdmin memasang endpoint admin di router yang sudah berada di bawah /api/v1.
func (h *Handler) MountAdmin(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.Route("/admin", func(r chi.Router) {
		r.Use(requireAuth)
		r.Use(auth.RequireAdmin)

		r.Get("/categories", h.ListCategories)
		r.Post("/categories", h.CreateCategory)
		r.Get("/categories/{id}", h.GetCategory)
		r.Put("/categories/{id}", h.UpdateCategory)
		r.Delete("/categories/{id}", h.DeleteCategory)

		r.Get("/products", h.ListProducts)
		r.Post("/products", h.CreateProduct)
		r.Get("/products/{id}", h.GetProduct)
		r.Put("/products/{id}", h.UpdateProduct)
		r.Delete("/products/{id}", h.DeleteProduct)
	})
}

// ---------- Helper ----------

func pathID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		errx.JSON(w, errx.NotFound("Data tidak ditemukan"))
		return "", false
	}
	return id, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) *errx.APIError {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return errx.BadRequest("Body request tidak valid")
	}
	return nil
}

func validationErr(details map[string]interface{}) *errx.APIError {
	return errx.ValidationError("Data yang dikirim tidak valid").WithDetails(details)
}

func internalError(w http.ResponseWriter, action string, err error) {
	slog.Error("catalog: "+action, slog.Any("error", err))
	errx.JSON(w, errx.InternalServerError("Terjadi kesalahan pada server"))
}

func pgError(err error) *pgconn.PgError {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr
	}
	return nil
}

// writePgConflict menerjemahkan error constraint database (mis. saat dua admin
// menyimpan slug yang sama bersamaan). Mengembalikan true jika sudah ditangani.
func writePgConflict(w http.ResponseWriter, err error) bool {
	pgErr := pgError(err)
	if pgErr == nil {
		return false
	}
	name := pgErr.ConstraintName

	switch pgErr.Code {
	case "23505": // unique_violation
		switch {
		case strings.Contains(name, "slug"):
			errx.JSON(w, errx.Conflict("Slug sudah dipakai").
				WithDetails(map[string]interface{}{"slug": "Slug sudah dipakai"}))
			return true
		case strings.Contains(name, "sku"):
			errx.JSON(w, errx.Conflict("SKU sudah dipakai").
				WithDetails(map[string]interface{}{"variants": "Ada SKU yang sudah dipakai"}))
			return true
		}
	case "23503": // foreign_key_violation
		switch {
		case strings.Contains(name, "category_id"):
			errx.JSON(w, validationErr(map[string]interface{}{"category_id": "Kategori tidak ditemukan"}))
			return true
		case strings.Contains(name, "parent_id"):
			errx.JSON(w, validationErr(map[string]interface{}{"parent_id": "Kategori induk tidak ditemukan"}))
			return true
		}
	}
	return false
}

// slugExists memeriksa slug di tabel categories atau products.
// Nama tabel hanya berasal dari konstanta di kode ini, bukan input pengguna.
func (s *Store) slugExists(ctx context.Context, table, slug, excludeID string) (bool, error) {
	var exists bool
	query := fmt.Sprintf(
		`SELECT EXISTS (SELECT 1 FROM %s WHERE slug = $1 AND ($2::text = '' OR id::text <> $2::text))`,
		table,
	)
	err := s.pool.QueryRow(ctx, query, slug, excludeID).Scan(&exists)
	return exists, err
}

// resolveSlug menentukan slug akhir.
//   - manual terisi: dipakai apa adanya (setelah dirapikan), conflict=true jika sudah dipakai.
//   - manual kosong: dibuat dari nama, ditambah -2, -3, ... jika bentrok.
func (s *Store) resolveSlug(ctx context.Context, table, manual, name, excludeID string) (slug string, conflict bool, err error) {
	if manual != "" {
		slug = slugify(manual)
		exists, err := s.slugExists(ctx, table, slug, excludeID)
		return slug, exists, err
	}

	base := slugify(name)
	slug = base
	for i := 2; i <= 1000; i++ {
		exists, err := s.slugExists(ctx, table, slug, excludeID)
		if err != nil {
			return "", false, err
		}
		if !exists {
			return slug, false, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
	return "", false, errors.New("could not generate unique slug")
}