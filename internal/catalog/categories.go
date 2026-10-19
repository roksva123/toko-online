package catalog

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

type Category struct {
	ID           string    `json:"id"`
	ParentID     *string   `json:"parent_id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	SortOrder    int       `json:"sort_order"`
	IsActive     bool      `json:"is_active"`
	ProductCount int       `json:"product_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type categoryInput struct {
	ParentID  *string `json:"parent_id"`
	Name      string  `json:"name"`
	Slug      string  `json:"slug"`
	SortOrder int     `json:"sort_order"`
	IsActive  *bool   `json:"is_active"`
}

func (in *categoryInput) normalize() {
	in.Name = strings.TrimSpace(in.Name)
	in.Slug = strings.TrimSpace(in.Slug)
	if in.ParentID != nil {
		p := strings.TrimSpace(*in.ParentID)
		if p == "" {
			in.ParentID = nil
		} else {
			in.ParentID = &p
		}
	}
}

func validateCategory(in categoryInput) map[string]interface{} {
	d := map[string]interface{}{}

	if n := utf8.RuneCountInString(in.Name); n < 2 || n > 255 {
		d["name"] = "Nama kategori 2 sampai 255 karakter"
	}
	if in.ParentID != nil {
		if _, err := uuid.Parse(*in.ParentID); err != nil {
			d["parent_id"] = "Kategori induk tidak valid"
		}
	}
	if in.SortOrder < 0 || in.SortOrder > 100000 {
		d["sort_order"] = "Urutan harus antara 0 dan 100000"
	}
	return d
}

// ---------- Store ----------

const categorySelect = `
	SELECT c.id::text, c.parent_id::text, c.name, c.slug, c.sort_order, c.is_active,
	       (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id),
	       c.created_at, c.updated_at
	FROM categories c`

func scanCategory(row interface{ Scan(dest ...any) error }) (*Category, error) {
	var c Category
	err := row.Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.SortOrder, &c.IsActive,
		&c.ProductCount, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := s.pool.Query(ctx, categorySelect+` ORDER BY c.sort_order, c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Category, 0)
	for rows.Next() {
		c, err := scanCategory(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *c)
	}
	return items, rows.Err()
}

func (s *Store) GetCategory(ctx context.Context, id string) (*Category, error) {
	c, err := scanCategory(s.pool.QueryRow(ctx, categorySelect+` WHERE c.id = $1::uuid`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return c, err
}

func (s *Store) CategoryExists(ctx context.Context, id string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM categories WHERE id = $1::uuid)`, id).Scan(&exists)
	return exists, err
}

func (s *Store) CategoryHasChildren(ctx context.Context, id string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM categories WHERE parent_id = $1::uuid)`, id).Scan(&exists)
	return exists, err
}

// isDescendant: apakah candidateID berada di bawah ancestorID (di level mana pun)?
// Dipakai agar kategori tidak bisa dipindah ke dalam cabangnya sendiri.
func (s *Store) isDescendant(ctx context.Context, ancestorID, candidateID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		WITH RECURSIVE sub AS (
			SELECT id FROM categories WHERE parent_id = $1::uuid
			UNION ALL
			SELECT c.id FROM categories c JOIN sub s ON c.parent_id = s.id
		)
		SELECT EXISTS (SELECT 1 FROM sub WHERE id = $2::uuid)`,
		ancestorID, candidateID).Scan(&exists)
	return exists, err
}

func (s *Store) CreateCategory(ctx context.Context, in categoryInput, slug string) (string, error) {
	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO categories (parent_id, name, slug, sort_order, is_active)
		VALUES ($1::uuid, $2, $3, $4, $5)
		RETURNING id::text`,
		in.ParentID, in.Name, slug, in.SortOrder, active).Scan(&id)
	return id, err
}

// UpdateCategory: slug kosong berarti slug lama dipertahankan.
func (s *Store) UpdateCategory(ctx context.Context, id string, in categoryInput, slug string) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE categories
		SET parent_id  = $2::uuid,
		    name       = $3,
		    slug       = COALESCE(NULLIF($4::text, ''), slug),
		    sort_order = $5,
		    is_active  = COALESCE($6::boolean, is_active),
		    updated_at = NOW()
		WHERE id = $1::uuid`,
		id, in.ParentID, in.Name, slug, in.SortOrder, in.IsActive)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) DeleteCategory(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM categories WHERE id = $1::uuid`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- Handlers ----------

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.store.ListCategories(r.Context())
	if err != nil {
		internalError(w, "list categories", err)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) GetCategory(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	cat, err := h.store.GetCategory(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.NotFound("Kategori tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "get category", err)
		return
	}
	response.JSON(w, http.StatusOK, cat, nil)
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var in categoryInput
	if apiErr := decodeJSON(w, r, &in); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}
	in.normalize()
	if d := validateCategory(in); len(d) > 0 {
		errx.JSON(w, validationErr(d))
		return
	}

	ctx := r.Context()

	if in.ParentID != nil {
		exists, err := h.store.CategoryExists(ctx, *in.ParentID)
		if err != nil {
			internalError(w, "check parent", err)
			return
		}
		if !exists {
			errx.JSON(w, validationErr(map[string]interface{}{"parent_id": "Kategori induk tidak ditemukan"}))
			return
		}
	}

	slug, conflict, err := h.store.resolveSlug(ctx, "categories", in.Slug, in.Name, "")
	if err != nil {
		internalError(w, "resolve slug", err)
		return
	}
	if conflict {
		errx.JSON(w, errx.Conflict("Slug sudah dipakai").
			WithDetails(map[string]interface{}{"slug": "Slug sudah dipakai"}))
		return
	}

	id, err := h.store.CreateCategory(ctx, in, slug)
	if err != nil {
		if writePgConflict(w, err) {
			return
		}
		internalError(w, "create category", err)
		return
	}

	cat, err := h.store.GetCategory(ctx, id)
	if err != nil {
		internalError(w, "get created category", err)
		return
	}
	response.JSON(w, http.StatusCreated, cat, nil)
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	var in categoryInput
	if apiErr := decodeJSON(w, r, &in); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}
	in.normalize()
	if d := validateCategory(in); len(d) > 0 {
		errx.JSON(w, validationErr(d))
		return
	}

	ctx := r.Context()

	if _, err := h.store.GetCategory(ctx, id); errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.NotFound("Kategori tidak ditemukan"))
		return
	} else if err != nil {
		internalError(w, "get category", err)
		return
	}

	if in.ParentID != nil {
		invalid := map[string]interface{}{"parent_id": "Kategori induk tidak valid"}

		if *in.ParentID == id {
			errx.JSON(w, validationErr(invalid))
			return
		}
		exists, err := h.store.CategoryExists(ctx, *in.ParentID)
		if err != nil {
			internalError(w, "check parent", err)
			return
		}
		if !exists {
			errx.JSON(w, validationErr(map[string]interface{}{"parent_id": "Kategori induk tidak ditemukan"}))
			return
		}
		cyclic, err := h.store.isDescendant(ctx, id, *in.ParentID)
		if err != nil {
			internalError(w, "check cycle", err)
			return
		}
		if cyclic {
			errx.JSON(w, validationErr(map[string]interface{}{
				"parent_id": "Kategori tidak bisa dipindah ke dalam sub-kategorinya sendiri",
			}))
			return
		}
	}

	// Slug hanya berubah jika admin mengisinya; mengganti nama tidak mengubah slug
	slug := ""
	if in.Slug != "" {
		s, conflict, err := h.store.resolveSlug(ctx, "categories", in.Slug, in.Name, id)
		if err != nil {
			internalError(w, "resolve slug", err)
			return
		}
		if conflict {
			errx.JSON(w, errx.Conflict("Slug sudah dipakai").
				WithDetails(map[string]interface{}{"slug": "Slug sudah dipakai"}))
			return
		}
		slug = s
	}

	if err := h.store.UpdateCategory(ctx, id, in, slug); err != nil {
		if errors.Is(err, ErrNotFound) {
			errx.JSON(w, errx.NotFound("Kategori tidak ditemukan"))
			return
		}
		if writePgConflict(w, err) {
			return
		}
		internalError(w, "update category", err)
		return
	}

	cat, err := h.store.GetCategory(ctx, id)
	if err != nil {
		internalError(w, "get updated category", err)
		return
	}
	response.JSON(w, http.StatusOK, cat, nil)
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	hasChildren, err := h.store.CategoryHasChildren(ctx, id)
	if err != nil {
		internalError(w, "check children", err)
		return
	}
	if hasChildren {
		errx.JSON(w, errx.New("CATEGORY_HAS_CHILDREN",
			"Kategori masih punya sub-kategori. Pindahkan atau hapus sub-kategorinya dulu.",
			http.StatusConflict))
		return
	}

	if err := h.store.DeleteCategory(ctx, id); err != nil {
		if errors.Is(err, ErrNotFound) {
			errx.JSON(w, errx.NotFound("Kategori tidak ditemukan"))
			return
		}
		if pg := pgError(err); pg != nil && pg.Code == "23503" {
			errx.JSON(w, errx.New("CATEGORY_HAS_PRODUCTS",
				"Kategori masih dipakai produk. Pindahkan produknya atau nonaktifkan kategori ini.",
				http.StatusConflict))
			return
		}
		internalError(w, "delete category", err)
		return
	}
	response.Empty(w, http.StatusNoContent)
}