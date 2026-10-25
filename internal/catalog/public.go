package catalog

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

var publicSlugRegex = regexp.MustCompile(`^[a-z0-9-]{1,255}$`)

// ---------- Tipe ----------

type PublicProduct struct {
	ID           string    `json:"id"`
	Slug         string    `json:"slug"`
	Name         string    `json:"name"`
	CategoryName string    `json:"category_name"`
	CategorySlug string    `json:"category_slug"`
	PriceMin     int64     `json:"price_min"`
	PriceMax     int64     `json:"price_max"`
	TotalStock   int64     `json:"total_stock"`
	Rating       float64   `json:"rating"`
	ReviewCount  int64     `json:"review_count"`
	ImageURL     string    `json:"image_url"`
	CreatedAt    time.Time `json:"created_at"`

	imageKey string
}

type PublicVariant struct {
	ID                 string   `json:"id"`
	SKU                string   `json:"sku"`
	Name               string   `json:"name"`
	Price              int64    `json:"price"`
	Stock              int      `json:"stock"`
	WeightGram         int      `json:"weight_gram"`
	AttributeOptionIDs []string `json:"attribute_option_ids"`
}

type PublicAttributeOption struct {
	ID    string `json:"id"`
	Value string `json:"value"`
}

type PublicAttribute struct {
	ID      string                  `json:"id"`
	Name    string                  `json:"name"`
	Options []PublicAttributeOption `json:"options"`
}

type PublicImage struct {
	ID  string `json:"id"`
	URL string `json:"url"`

	key string
}

type PublicProductDetail struct {
	ID           string            `json:"id"`
	Slug         string            `json:"slug"`
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	CategoryName string            `json:"category_name"`
	CategorySlug string            `json:"category_slug"`
	CreatedAt    time.Time         `json:"created_at"`
	Rating       float64           `json:"rating"`
	ReviewCount  int64             `json:"review_count"`
	Images       []PublicImage     `json:"images"`
	Variants     []PublicVariant   `json:"variants"`
	Attributes   []PublicAttribute `json:"attributes"`
}

type publicFilter struct {
	Query        string
	CategorySlug string
	Sort         string // "", "price_asc", "price_desc"
	Page         int
	Limit        int
}

// ---------- Store ----------

// ListPublicProducts hanya menampilkan produk aktif, di kategori aktif,
// yang punya minimal satu varian aktif.
func (s *Store) ListPublicProducts(ctx context.Context, f publicFilter) ([]PublicProduct, int64, error) {
	const from = `
		FROM products p
		JOIN categories c ON c.id = p.category_id AND c.is_active = TRUE
		JOIN product_variants v ON v.product_id = p.id AND v.is_active = TRUE`

	conds := []string{"p.is_active = TRUE"}
	var args []any
	add := func(cond string, arg any) {
		args = append(args, arg)
		conds = append(conds, strings.ReplaceAll(cond, "?", fmt.Sprintf("$%d", len(args))))
	}

	if f.Query != "" {
		add(`p.name ILIKE '%' || ? || '%'`, escapeLike(f.Query))
	}
	if f.CategorySlug != "" {
		// termasuk produk di sub-kategori
		add(`(c.slug = ? OR c.parent_id IN (SELECT id FROM categories WHERE slug = ?))`, f.CategorySlug)
	}
	where := " WHERE " + strings.Join(conds, " AND ")

	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT p.id)`+from+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "p.created_at DESC, p.id"
	switch f.Sort {
	case "price_asc":
		orderBy = "MIN(v.price) ASC, p.id"
	case "price_desc":
		orderBy = "MIN(v.price) DESC, p.id"
	}

	args = append(args, f.Limit, (f.Page-1)*f.Limit)
	query := `
		SELECT p.id::text, p.slug, p.name, c.name, c.slug,
		       MIN(v.price), MAX(v.price), COALESCE(SUM(v.stock), 0),
		       COALESCE((SELECT AVG(pr.rating) FROM product_reviews pr WHERE pr.product_id = p.id), 0),
		       COALESCE((SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = p.id), 0),
		       COALESCE((SELECT i.storage_key FROM product_images i
		                 WHERE i.product_id = p.id
		                 ORDER BY i.sort_order, i.created_at LIMIT 1), ''),
		       p.created_at` + from + where + fmt.Sprintf(
		` GROUP BY p.id, c.name, c.slug ORDER BY %s LIMIT $%d OFFSET $%d`,
		orderBy, len(args)-1, len(args))

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]PublicProduct, 0)
	for rows.Next() {
		var p PublicProduct
		if err := rows.Scan(&p.ID, &p.Slug, &p.Name, &p.CategoryName, &p.CategorySlug,
			&p.PriceMin, &p.PriceMax, &p.TotalStock, &p.Rating, &p.ReviewCount, &p.imageKey, &p.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, p)
	}
	return items, total, rows.Err()
}

func (s *Store) GetPublicProduct(ctx context.Context, slug string) (*PublicProductDetail, error) {
	var p PublicProductDetail
	err := s.pool.QueryRow(ctx, `
		SELECT p.id::text, p.slug, p.name, COALESCE(p.description, ''),
		       c.name, c.slug, p.created_at,
		       COALESCE((SELECT AVG(pr.rating) FROM product_reviews pr WHERE pr.product_id = p.id), 0),
		       COALESCE((SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = p.id), 0)
		FROM products p
		JOIN categories c ON c.id = p.category_id AND c.is_active = TRUE
		WHERE p.slug = $1 AND p.is_active = TRUE`, slug,
	).Scan(&p.ID, &p.Slug, &p.Name, &p.Description, &p.CategoryName, &p.CategorySlug, &p.CreatedAt, &p.Rating, &p.ReviewCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	vrows, err := s.pool.Query(ctx, `
		SELECT id::text, sku, name, price, stock, weight_gram
		FROM product_variants
		WHERE product_id = $1::uuid AND is_active = TRUE
		ORDER BY created_at, name`, p.ID)
	if err != nil {
		return nil, err
	}
	defer vrows.Close()

	p.Variants = make([]PublicVariant, 0)
	for vrows.Next() {
		var v PublicVariant
		if err := vrows.Scan(&v.ID, &v.SKU, &v.Name, &v.Price, &v.Stock, &v.WeightGram); err != nil {
			return nil, err
		}
		p.Variants = append(p.Variants, v)
	}
	if err := vrows.Err(); err != nil {
		return nil, err
	}
	if len(p.Variants) == 0 {
		return nil, ErrNotFound // produk tanpa varian aktif tidak bisa dibeli
	}

	attributeRows, err := s.pool.Query(ctx, `
		SELECT a.id::text, a.name, ao.id::text, ao.value
		FROM attributes a
		JOIN attribute_options ao ON ao.attribute_id = a.id
		WHERE a.product_id = $1::uuid
		ORDER BY a.created_at, ao.created_at, ao.value`, p.ID)
	if err != nil {
		return nil, err
	}
	defer attributeRows.Close()

	attributeMap := make(map[string]*PublicAttribute)
	attributeIDs := make([]string, 0)
	for attributeRows.Next() {
		var attributeID, attributeName, optionID, optionValue string
		if err := attributeRows.Scan(&attributeID, &attributeName, &optionID, &optionValue); err != nil {
			return nil, err
		}
		if _, exists := attributeMap[attributeID]; !exists {
			attributeMap[attributeID] = &PublicAttribute{
				ID: attributeID, Name: attributeName, Options: make([]PublicAttributeOption, 0),
			}
			attributeIDs = append(attributeIDs, attributeID)
		}
		attributeMap[attributeID].Options = append(attributeMap[attributeID].Options,
			PublicAttributeOption{ID: optionID, Value: optionValue})
	}
	if err := attributeRows.Err(); err != nil {
		return nil, err
	}
	p.Attributes = make([]PublicAttribute, 0, len(attributeIDs))
	for _, attributeID := range attributeIDs {
		p.Attributes = append(p.Attributes, *attributeMap[attributeID])
	}

	for i := range p.Variants {
		optionRows, err := s.pool.Query(ctx, `
			SELECT attribute_option_id::text
			FROM variant_attribute_values
			WHERE variant_id = $1::uuid`, p.Variants[i].ID)
		if err != nil {
			return nil, err
		}
		p.Variants[i].AttributeOptionIDs = make([]string, 0)
		for optionRows.Next() {
			var optionID string
			if err := optionRows.Scan(&optionID); err != nil {
				optionRows.Close()
				return nil, err
			}
			p.Variants[i].AttributeOptionIDs = append(p.Variants[i].AttributeOptionIDs, optionID)
		}
		if err := optionRows.Err(); err != nil {
			optionRows.Close()
			return nil, err
		}
		optionRows.Close()
	}

	irows, err := s.pool.Query(ctx, `
		SELECT id::text, storage_key
		FROM product_images
		WHERE product_id = $1::uuid
		ORDER BY sort_order, created_at`, p.ID)
	if err != nil {
		return nil, err
	}
	defer irows.Close()

	p.Images = make([]PublicImage, 0)
	for irows.Next() {
		var img PublicImage
		if err := irows.Scan(&img.ID, &img.key); err != nil {
			return nil, err
		}
		p.Images = append(p.Images, img)
	}
	return &p, irows.Err()
}

// ---------- Handler ----------

type PublicHandler struct {
	store *Store
	// imageBase adalah URL publik server API yang menyajikan folder uploads.
	imageBase string
}

func NewPublicHandler(pool *pgxpool.Pool, imageBase string) *PublicHandler {
	return &PublicHandler{store: NewStore(pool), imageBase: strings.TrimRight(imageBase, "/")}
}

// Mount memasang endpoint publik (tanpa login) di router /api/v1.
func (h *PublicHandler) Mount(r chi.Router) {
	r.Get("/categories", h.ListCategories)
	r.Get("/products", h.ListProducts)
	r.Get("/products/{slug}", h.GetProduct)
}

func (h *PublicHandler) imageURL(key string) string {
	if key == "" || h.imageBase == "" {
		return ""
	}
	return h.imageBase + "/uploads/" + strings.TrimLeft(key, "/")
}

func (h *PublicHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	f := publicFilter{
		Query:        strings.TrimSpace(q.Get("q")),
		CategorySlug: strings.TrimSpace(q.Get("category")),
		Sort:         q.Get("sort"),
		Page:         1,
		Limit:        12,
	}
	if p, err := strconv.Atoi(q.Get("page")); err == nil && p > 0 {
		f.Page = p
	}
	if l, err := strconv.Atoi(q.Get("limit")); err == nil && l > 0 {
		f.Limit = min(l, 48)
	}
	if f.Sort != "price_asc" && f.Sort != "price_desc" {
		f.Sort = ""
	}
	if f.CategorySlug != "" && !publicSlugRegex.MatchString(f.CategorySlug) {
		response.JSONWithMeta(w, http.StatusOK, []PublicProduct{}, f.Page, f.Limit, 0)
		return
	}

	items, total, err := h.store.ListPublicProducts(r.Context(), f)
	if err != nil {
		internalError(w, "list public products", err)
		return
	}
	for i := range items {
		items[i].ImageURL = h.imageURL(items[i].imageKey)
	}
	response.JSONWithMeta(w, http.StatusOK, items, f.Page, f.Limit, total)
}

func (h *PublicHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if !publicSlugRegex.MatchString(slug) {
		errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		return
	}

	p, err := h.store.GetPublicProduct(r.Context(), slug)
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "get public product", err)
		return
	}
	for i := range p.Images {
		p.Images[i].URL = h.imageURL(p.Images[i].key)
	}
	response.JSON(w, http.StatusOK, p, nil)
}

// ---------- Kategori publik ----------

type PublicCategory struct {
	ID        string  `json:"id"`
	ParentID  *string `json:"parent_id"`
	Name      string  `json:"name"`
	Slug      string  `json:"slug"`
	SortOrder int     `json:"sort_order"`
}

// ListPublicCategories hanya mengembalikan kategori yang aktif.
func (s *Store) ListPublicCategories(ctx context.Context) ([]PublicCategory, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, parent_id::text, name, slug, sort_order
		FROM categories
		WHERE is_active = TRUE
		ORDER BY sort_order, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]PublicCategory, 0)
	for rows.Next() {
		var c PublicCategory
		if err := rows.Scan(&c.ID, &c.ParentID, &c.Name, &c.Slug, &c.SortOrder); err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}

func (h *PublicHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	items, err := h.store.ListPublicCategories(r.Context())
	if err != nil {
		internalError(w, "list public categories", err)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}
