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
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

var (
	skuRegex = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)

	errVariantNotFound = errors.New("variant not found in product")
)

// ---------- Tipe ----------

type ProductSummary struct {
	ID           string    `json:"id"`
	CategoryID   string    `json:"category_id"`
	CategoryName string    `json:"category_name"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Description  string    `json:"description"`
	IsActive     bool      `json:"is_active"`
	PriceMin     int64     `json:"price_min"`
	PriceMax     int64     `json:"price_max"`
	TotalStock   int64     `json:"total_stock"`
	VariantCount int64     `json:"variant_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Variant struct {
	ID         string `json:"id"`
	ProductID  string `json:"product_id"`
	SKU        string `json:"sku"`
	Name       string `json:"name"`
	Price      int64  `json:"price"`
	Stock      int    `json:"stock"`
	WeightGram int    `json:"weight_gram"`
	IsActive   bool   `json:"is_active"`
}

type ProductDetail struct {
	ProductSummary
	Variants []Variant `json:"variants"`
}

type variantInput struct {
	ID                 string   `json:"id"` // kosong = varian baru
	SKU                string   `json:"sku"`
	Name               string   `json:"name"`
	Price              int64    `json:"price"`
	Stock              int      `json:"stock"`
	WeightGram         int      `json:"weight_gram"`
	IsActive           *bool    `json:"is_active"`
	AttributeOptionIDs []string `json:"attribute_option_ids"`
}

type productInput struct {
	CategoryID  string         `json:"category_id"`
	Name        string         `json:"name"`
	Slug        string         `json:"slug"`
	Description string         `json:"description"`
	IsActive    *bool          `json:"is_active"`
	Variants    []variantInput `json:"variants"`
}

func (in *productInput) normalize() {
	in.CategoryID = strings.TrimSpace(in.CategoryID)
	in.Name = strings.TrimSpace(in.Name)
	in.Slug = strings.TrimSpace(in.Slug)
	in.Description = strings.TrimSpace(in.Description)
	for i := range in.Variants {
		v := &in.Variants[i]
		v.ID = strings.TrimSpace(v.ID)
		v.SKU = strings.TrimSpace(v.SKU)
		v.Name = strings.TrimSpace(v.Name)
	}
}

func validateProduct(in productInput) map[string]interface{} {
	d := map[string]interface{}{}

	if n := utf8.RuneCountInString(in.Name); n < 2 || n > 255 {
		d["name"] = "Nama produk 2 sampai 255 karakter"
	}
	if _, err := uuid.Parse(in.CategoryID); err != nil {
		d["category_id"] = "Pilih kategori"
	}
	if utf8.RuneCountInString(in.Description) > 10000 {
		d["description"] = "Deskripsi terlalu panjang"
	}

	if len(in.Variants) == 0 {
		d["variants"] = "Tambahkan minimal satu varian"
		return d
	}
	if len(in.Variants) > 100 {
		d["variants"] = "Maksimal 100 varian per produk"
		return d
	}

	seenSKU := map[string]bool{}
	for i, v := range in.Variants {
		key := func(field string) string { return fmt.Sprintf("variants.%d.%s", i, field) }

		if v.ID != "" {
			if _, err := uuid.Parse(v.ID); err != nil {
				d[key("id")] = "ID varian tidak valid"
			}
		}
		if !skuRegex.MatchString(v.SKU) {
			d[key("sku")] = "SKU wajib diisi (huruf, angka, titik, garis bawah, atau tanda hubung)"
		} else if seenSKU[v.SKU] {
			d[key("sku")] = "SKU kembar di produk ini"
		}
		seenSKU[v.SKU] = true

		if n := utf8.RuneCountInString(v.Name); n < 1 || n > 255 {
			d[key("name")] = "Nama varian wajib diisi"
		}
		if v.Price <= 0 {
			d[key("price")] = "Harga harus lebih dari 0"
		}
		if v.Stock < 0 || v.Stock > 100000000 {
			d[key("stock")] = "Stok tidak valid"
		}
		if v.WeightGram < 0 || v.WeightGram > 100000000 {
			d[key("weight_gram")] = "Berat tidak valid"
		}
	}
	return d
}

// ---------- Store ----------

const productSelect = `
	SELECT p.id::text, p.category_id::text, c.name, p.name, p.slug,
	       COALESCE(p.description, ''), p.is_active,
	       COALESCE(MIN(v.price) FILTER (WHERE v.is_active), 0),
	       COALESCE(MAX(v.price) FILTER (WHERE v.is_active), 0),
	       COALESCE(SUM(v.stock) FILTER (WHERE v.is_active), 0),
	       COUNT(v.id) FILTER (WHERE v.is_active),
	       p.created_at, p.updated_at
	FROM products p
	JOIN categories c ON c.id = p.category_id
	LEFT JOIN product_variants v ON v.product_id = p.id`

func scanProduct(row interface{ Scan(dest ...any) error }) (*ProductSummary, error) {
	var p ProductSummary
	err := row.Scan(&p.ID, &p.CategoryID, &p.CategoryName, &p.Name, &p.Slug,
		&p.Description, &p.IsActive, &p.PriceMin, &p.PriceMax, &p.TotalStock,
		&p.VariantCount, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

type productFilter struct {
	Query      string
	CategoryID string
	Status     string // "", "active", "inactive"
	Page       int
	Limit      int
}

func (s *Store) ListProducts(ctx context.Context, f productFilter) ([]ProductSummary, int64, error) {
	var conds []string
	var args []any
	add := func(cond string, arg any) {
		args = append(args, arg)
		conds = append(conds, strings.ReplaceAll(cond, "?", fmt.Sprintf("$%d", len(args))))
	}

	if f.Query != "" {
		add(`p.name ILIKE '%' || ? || '%'`, escapeLike(f.Query))
	}
	if f.CategoryID != "" {
		add(`p.category_id = ?::uuid`, f.CategoryID)
	}
	switch f.Status {
	case "active":
		conds = append(conds, `p.is_active = TRUE`)
	case "inactive":
		conds = append(conds, `p.is_active = FALSE`)
	}

	where := ""
	if len(conds) > 0 {
		where = " WHERE " + strings.Join(conds, " AND ")
	}

	var total int64
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM products p`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, f.Limit, (f.Page-1)*f.Limit)
	query := productSelect + where + fmt.Sprintf(
		` GROUP BY p.id, c.name ORDER BY p.created_at DESC, p.id LIMIT $%d OFFSET $%d`,
		len(args)-1, len(args))

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]ProductSummary, 0)
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *p)
	}
	return items, total, rows.Err()
}

func (s *Store) GetProduct(ctx context.Context, id string) (*ProductDetail, error) {
	p, err := scanProduct(s.pool.QueryRow(ctx,
		productSelect+` WHERE p.id = $1::uuid GROUP BY p.id, c.name`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id::text, product_id::text, sku, name, price, stock, weight_gram, is_active
		FROM product_variants
		WHERE product_id = $1::uuid
		ORDER BY created_at, name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	variants := make([]Variant, 0)
	for rows.Next() {
		var v Variant
		if err := rows.Scan(&v.ID, &v.ProductID, &v.SKU, &v.Name, &v.Price,
			&v.Stock, &v.WeightGram, &v.IsActive); err != nil {
			return nil, err
		}
		variants = append(variants, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ProductDetail{ProductSummary: *p, Variants: variants}, nil
}

// ConflictingSKUs mengembalikan SKU di daftar yang sudah dipakai produk lain.
func (s *Store) ConflictingSKUs(ctx context.Context, skus []string, excludeProductID string) (map[string]bool, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT sku FROM product_variants
		WHERE sku = ANY($1::text[])
		  AND ($2::text = '' OR product_id::text <> $2::text)`,
		skus, excludeProductID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]bool{}
	for rows.Next() {
		var sku string
		if err := rows.Scan(&sku); err != nil {
			return nil, err
		}
		out[sku] = true
	}
	return out, rows.Err()
}

func insertVariant(ctx context.Context, tx pgx.Tx, productID string, v variantInput) error {
	active := true
	if v.IsActive != nil {
		active = *v.IsActive
	}
	var variantID string
	err := tx.QueryRow(ctx, `
		INSERT INTO product_variants (product_id, sku, name, price, stock, weight_gram, is_active)
		VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
		RETURNING id::text`,
		productID, v.SKU, v.Name, v.Price, v.Stock, v.WeightGram, active).Scan(&variantID)
	if err != nil {
		return err
	}
	if v.Stock > 0 {
		return insertStockMovement(ctx, tx, variantID, v.Stock, "initial_stock")
	}
	return nil
}

func insertStockMovement(ctx context.Context, tx pgx.Tx, variantID string, delta int, reason string) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO stock_movements (variant_id, delta, reason) VALUES ($1::uuid, $2, $3)`,
		variantID, delta, reason)
	return err
}

func (s *Store) CreateProduct(ctx context.Context, in productInput, slug string) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	active := true
	if in.IsActive != nil {
		active = *in.IsActive
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO products (category_id, name, slug, description, is_active)
		VALUES ($1::uuid, $2, $3, $4, $5)
		RETURNING id::text`,
		in.CategoryID, in.Name, slug, in.Description, active).Scan(&id)
	if err != nil {
		return "", err
	}

	for _, v := range in.Variants {
		if err := insertVariant(ctx, tx, id, v); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}

// UpdateProduct memperbarui produk dan menyinkronkan varian:
//   - varian dengan id    -> diperbarui (perubahan stok dicatat di stock_movements)
//   - varian tanpa id     -> ditambahkan
//   - varian yang tidak dikirim -> dinonaktifkan, bukan dihapus, karena mungkin
//     sudah ada di pesanan lama.
//
// slug kosong berarti slug lama dipertahankan.
func (s *Store) UpdateProduct(ctx context.Context, id string, in productInput, slug string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE products
		SET category_id = $2::uuid,
		    name        = $3,
		    slug        = COALESCE(NULLIF($4::text, ''), slug),
		    description = $5,
		    is_active   = COALESCE($6::boolean, is_active),
		    updated_at  = NOW()
		WHERE id = $1::uuid`,
		id, in.CategoryID, in.Name, slug, in.Description, in.IsActive)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	// Kunci varian yang ada supaya perubahan stok tidak tabrakan dengan checkout
	rows, err := tx.Query(ctx,
		`SELECT id::text, stock FROM product_variants WHERE product_id = $1::uuid FOR UPDATE`, id)
	if err != nil {
		return err
	}
	existing := map[string]int{}
	for rows.Next() {
		var vid string
		var stock int
		if err := rows.Scan(&vid, &stock); err != nil {
			rows.Close()
			return err
		}
		existing[vid] = stock
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	kept := map[string]bool{}
	for _, v := range in.Variants {
		if v.ID == "" {
			if err := insertVariant(ctx, tx, id, v); err != nil {
				return err
			}
			continue
		}

		oldStock, found := existing[v.ID]
		if !found {
			return errVariantNotFound
		}
		kept[v.ID] = true

		active := true
		if v.IsActive != nil {
			active = *v.IsActive
		}
		_, err := tx.Exec(ctx, `
			UPDATE product_variants
			SET sku = $2, name = $3, price = $4, stock = $5,
			    weight_gram = $6, is_active = $7, updated_at = NOW()
			WHERE id = $1::uuid`,
			v.ID, v.SKU, v.Name, v.Price, v.Stock, v.WeightGram, active)
		if err != nil {
			return err
		}
		if delta := v.Stock - oldStock; delta != 0 {
			if err := insertStockMovement(ctx, tx, v.ID, delta, "admin_adjustment"); err != nil {
				return err
			}
		}
	}

	for vid := range existing {
		if !kept[vid] {
			if _, err := tx.Exec(ctx,
				`UPDATE product_variants SET is_active = FALSE, updated_at = NOW() WHERE id = $1::uuid`,
				vid); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (s *Store) DeleteProduct(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM products WHERE id = $1::uuid`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------- Handlers ----------

func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	f := productFilter{
		Query:      strings.TrimSpace(q.Get("q")),
		CategoryID: strings.TrimSpace(q.Get("category_id")),
		Status:     q.Get("status"),
		Page:       1,
		Limit:      20,
	}
	if p, err := strconv.Atoi(q.Get("page")); err == nil && p > 0 {
		f.Page = p
	}
	if l, err := strconv.Atoi(q.Get("limit")); err == nil && l > 0 {
		f.Limit = min(l, 100)
	}
	if f.CategoryID != "" {
		if _, err := uuid.Parse(f.CategoryID); err != nil {
			errx.JSON(w, validationErr(map[string]interface{}{"category_id": "Kategori tidak valid"}))
			return
		}
	}
	if f.Status != "" && f.Status != "active" && f.Status != "inactive" {
		f.Status = ""
	}

	items, total, err := h.store.ListProducts(r.Context(), f)
	if err != nil {
		internalError(w, "list products", err)
		return
	}
	response.JSONWithMeta(w, http.StatusOK, items, f.Page, f.Limit, total)
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	p, err := h.store.GetProduct(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "get product", err)
		return
	}
	response.JSON(w, http.StatusOK, p, nil)
}

// checkProductInput menjalankan pemeriksaan yang butuh database
// (kategori ada, SKU belum dipakai). Mengembalikan false jika response sudah ditulis.
func (h *Handler) checkProductInput(w http.ResponseWriter, ctx context.Context, in productInput, excludeProductID string) bool {
	exists, err := h.store.CategoryExists(ctx, in.CategoryID)
	if err != nil {
		internalError(w, "check category", err)
		return false
	}
	if !exists {
		errx.JSON(w, validationErr(map[string]interface{}{"category_id": "Kategori tidak ditemukan"}))
		return false
	}

	skus := make([]string, 0, len(in.Variants))
	for _, v := range in.Variants {
		skus = append(skus, v.SKU)
	}
	taken, err := h.store.ConflictingSKUs(ctx, skus, excludeProductID)
	if err != nil {
		internalError(w, "check sku", err)
		return false
	}
	if len(taken) > 0 {
		details := map[string]interface{}{}
		for i, v := range in.Variants {
			if taken[v.SKU] {
				details[fmt.Sprintf("variants.%d.sku", i)] = "SKU sudah dipakai produk lain"
			}
		}
		errx.JSON(w, errx.Conflict("SKU sudah dipakai produk lain").WithDetails(details))
		return false
	}
	return true
}

func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var in productInput
	if apiErr := decodeJSON(w, r, &in); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}
	in.normalize()
	if d := validateProduct(in); len(d) > 0 {
		errx.JSON(w, validationErr(d))
		return
	}

	ctx := r.Context()
	if !h.checkProductInput(w, ctx, in, "") {
		return
	}

	slug, conflict, err := h.store.resolveSlug(ctx, "products", in.Slug, in.Name, "")
	if err != nil {
		internalError(w, "resolve slug", err)
		return
	}
	if conflict {
		errx.JSON(w, errx.Conflict("Slug sudah dipakai").
			WithDetails(map[string]interface{}{"slug": "Slug sudah dipakai"}))
		return
	}

	id, err := h.store.CreateProduct(ctx, in, slug)
	if err != nil {
		if writePgConflict(w, err) {
			return
		}
		internalError(w, "create product", err)
		return
	}

	p, err := h.store.GetProduct(ctx, id)
	if err != nil {
		internalError(w, "get created product", err)
		return
	}
	response.JSON(w, http.StatusCreated, p, nil)
}

func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	var in productInput
	if apiErr := decodeJSON(w, r, &in); apiErr != nil {
		errx.JSON(w, apiErr)
		return
	}
	in.normalize()
	if d := validateProduct(in); len(d) > 0 {
		errx.JSON(w, validationErr(d))
		return
	}

	ctx := r.Context()

	if _, err := h.store.GetProduct(ctx, id); errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		return
	} else if err != nil {
		internalError(w, "get product", err)
		return
	}

	if !h.checkProductInput(w, ctx, in, id) {
		return
	}

	// Slug hanya berubah jika admin mengisinya; mengganti nama tidak mengubah slug
	slug := ""
	if in.Slug != "" {
		s, conflict, err := h.store.resolveSlug(ctx, "products", in.Slug, in.Name, id)
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

	if err := h.store.UpdateProduct(ctx, id, in, slug); err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		case errors.Is(err, errVariantNotFound):
			errx.JSON(w, validationErr(map[string]interface{}{
				"variants": "Ada varian yang bukan milik produk ini. Muat ulang halaman lalu coba lagi.",
			}))
		case writePgConflict(w, err):
			// sudah ditulis
		default:
			internalError(w, "update product", err)
		}
		return
	}

	p, err := h.store.GetProduct(ctx, id)
	if err != nil {
		internalError(w, "get updated product", err)
		return
	}
	response.JSON(w, http.StatusOK, p, nil)
}

func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}

	if err := h.store.DeleteProduct(r.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
			return
		}
		if pg := pgError(err); pg != nil && pg.Code == "23503" {
			errx.JSON(w, errx.New("PRODUCT_HAS_ORDERS",
				"Produk sudah pernah dipesan dan tidak bisa dihapus. Nonaktifkan saja.",
				http.StatusConflict))
			return
		}
		internalError(w, "delete product", err)
		return
	}
	response.Empty(w, http.StatusNoContent)
}