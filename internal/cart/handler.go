package cart

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/toko-online/internal/auth"
	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

var (
	ErrNotFound = errors.New("cart item not found")
	ErrInvalid  = errors.New("invalid cart item")
	ErrStock    = errors.New("insufficient stock")
)

type Handler struct {
	pool *pgxpool.Pool
}

type cartItem struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	VariantID   string `json:"variant_id"`
	VariantName string `json:"variant_name"`
	Price       int64  `json:"price"`
	Quantity    int    `json:"quantity"`
	ImageURL    string `json:"image_url"`
}

type itemInput struct {
	VariantID string `json:"variant_id"`
	Quantity  int    `json:"quantity"`
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

func (h *Handler) Mount(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.Route("/cart", func(r chi.Router) {
		r.Use(requireAuth)
		r.Get("/", h.Get)
		r.Post("/items", h.AddItem)
		r.Patch("/items/{variantID}", h.UpdateItem)
		r.Delete("/items/{variantID}", h.DeleteItem)
		r.Delete("/", h.Clear)
	})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	items, err := h.listItems(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		internalError(w, "get cart", err)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) AddItem(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeItemInput(w, r)
	if !ok {
		return
	}
	if _, err := uuid.Parse(in.VariantID); err != nil {
		errx.JSON(w, errx.ValidationError("Varian produk tidak valid"))
		return
	}

	if err := h.addItem(r.Context(), auth.UserID(r.Context()), in); err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			errx.JSON(w, errx.NotFound("Varian produk tidak ditemukan atau tidak aktif"))
		case errors.Is(err, ErrStock):
			errx.JSON(w, errx.Conflict("Jumlah produk melebihi stok yang tersedia"))
		case errors.Is(err, ErrInvalid):
			errx.JSON(w, errx.ValidationError("Jumlah produk harus lebih dari 0"))
		default:
			internalError(w, "add cart item", err)
		}
		return
	}

	items, err := h.listItems(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		internalError(w, "get cart after add", err)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	variantID := chi.URLParam(r, "variantID")
	if _, err := uuid.Parse(variantID); err != nil {
		errx.JSON(w, errx.NotFound("Item keranjang tidak ditemukan"))
		return
	}

	in, ok := decodeQuantityInput(w, r)
	if !ok {
		return
	}
	if err := h.updateItem(r.Context(), auth.UserID(r.Context()), variantID, in.Quantity); err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			errx.JSON(w, errx.NotFound("Item keranjang tidak ditemukan"))
		case errors.Is(err, ErrStock):
			errx.JSON(w, errx.Conflict("Jumlah produk melebihi stok yang tersedia"))
		case errors.Is(err, ErrInvalid):
			errx.JSON(w, errx.ValidationError("Jumlah produk harus lebih dari 0"))
		default:
			internalError(w, "update cart item", err)
		}
		return
	}

	items, err := h.listItems(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		internalError(w, "get cart after update", err)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	variantID := chi.URLParam(r, "variantID")
	if _, err := uuid.Parse(variantID); err != nil {
		errx.JSON(w, errx.NotFound("Item keranjang tidak ditemukan"))
		return
	}

	if err := h.deleteItem(r.Context(), auth.UserID(r.Context()), variantID); err != nil {
		if errors.Is(err, ErrNotFound) {
			errx.JSON(w, errx.NotFound("Item keranjang tidak ditemukan"))
			return
		}
		internalError(w, "delete cart item", err)
		return
	}
	response.Empty(w, http.StatusNoContent)
}

func (h *Handler) Clear(w http.ResponseWriter, r *http.Request) {
	_, err := h.pool.Exec(r.Context(), `
		DELETE FROM cart_items
		WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1::uuid)`, auth.UserID(r.Context()))
	if err != nil {
		internalError(w, "clear cart", err)
		return
	}
	response.Empty(w, http.StatusNoContent)
}

func (h *Handler) listItems(ctx context.Context, userID string) ([]cartItem, error) {
	rows, err := h.pool.Query(ctx, `
		SELECT p.id::text,
		       p.name,
		       v.id::text,
		       v.name,
		       v.price,
		       ci.quantity,
		       COALESCE((
		           SELECT '/uploads/' || pi.storage_key
		           FROM product_images pi
		           WHERE pi.product_id = p.id
		           ORDER BY pi.sort_order, pi.created_at
		           LIMIT 1
		       ), '')
		FROM cart_items ci
		JOIN carts c ON c.id = ci.cart_id
		JOIN product_variants v ON v.id = ci.variant_id
		JOIN products p ON p.id = v.product_id
		WHERE c.user_id = $1::uuid
		ORDER BY ci.created_at, ci.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]cartItem, 0)
	for rows.Next() {
		var item cartItem
		if err := rows.Scan(
			&item.ProductID,
			&item.ProductName,
			&item.VariantID,
			&item.VariantName,
			&item.Price,
			&item.Quantity,
			&item.ImageURL,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) addItem(ctx context.Context, userID string, in itemInput) error {
	if in.Quantity <= 0 {
		return ErrInvalid
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var cartID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO carts (user_id)
		VALUES ($1::uuid)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
		RETURNING id::text`, userID).Scan(&cartID); err != nil {
		return err
	}

	var stock int
	if err := tx.QueryRow(ctx, `
		SELECT v.stock
		FROM product_variants v
		JOIN products p ON p.id = v.product_id
		WHERE v.id = $1::uuid
		  AND v.is_active = TRUE
		  AND p.is_active = TRUE
		FOR UPDATE`, in.VariantID).Scan(&stock); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	var current int
	err = tx.QueryRow(ctx, `
		SELECT quantity
		FROM cart_items
		WHERE cart_id = $1::uuid AND variant_id = $2::uuid
		FOR UPDATE`, cartID, in.VariantID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		current = 0
	} else if err != nil {
		return err
	}
	if current+in.Quantity > stock {
		return ErrStock
	}

	if current == 0 {
		_, err = tx.Exec(ctx, `
			INSERT INTO cart_items (cart_id, variant_id, quantity)
			VALUES ($1::uuid, $2::uuid, $3)`, cartID, in.VariantID, in.Quantity)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE cart_items
			SET quantity = $3, updated_at = NOW()
			WHERE cart_id = $1::uuid AND variant_id = $2::uuid`, cartID, in.VariantID, current+in.Quantity)
	}
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (h *Handler) updateItem(ctx context.Context, userID, variantID string, quantity int) error {
	if quantity <= 0 {
		return ErrInvalid
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var stock int
	if err := tx.QueryRow(ctx, `
		SELECT v.stock
		FROM product_variants v
		JOIN products p ON p.id = v.product_id
		JOIN cart_items ci ON ci.variant_id = v.id
		JOIN carts c ON c.id = ci.cart_id AND c.user_id = $2::uuid
		WHERE v.id = $1::uuid
		  AND v.is_active = TRUE
		  AND p.is_active = TRUE
		FOR UPDATE OF v`, variantID, userID).Scan(&stock); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if quantity > stock {
		return ErrStock
	}

	result, err := tx.Exec(ctx, `
		UPDATE cart_items ci
		SET quantity = $3, updated_at = NOW()
		FROM carts c
		WHERE ci.cart_id = c.id
		  AND c.user_id = $1::uuid
		  AND ci.variant_id = $2::uuid`, userID, variantID, quantity)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return tx.Commit(ctx)
}

func (h *Handler) deleteItem(ctx context.Context, userID, variantID string) error {
	result, err := h.pool.Exec(ctx, `
		DELETE FROM cart_items ci
		USING carts c
		WHERE ci.cart_id = c.id
		  AND c.user_id = $1::uuid
		  AND ci.variant_id = $2::uuid`, userID, variantID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func decodeItemInput(w http.ResponseWriter, r *http.Request) (itemInput, bool) {
	var in itemInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		errx.JSON(w, errx.BadRequest("Data item keranjang tidak valid"))
		return in, false
	}
	in.VariantID = strings.TrimSpace(in.VariantID)
	return in, true
}

func decodeQuantityInput(w http.ResponseWriter, r *http.Request) (itemInput, bool) {
	var in struct {
		Quantity int `json:"quantity"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		errx.JSON(w, errx.BadRequest("Data jumlah keranjang tidak valid"))
		return itemInput{}, false
	}
	return itemInput{Quantity: in.Quantity}, true
}

func internalError(w http.ResponseWriter, action string, err error) {
	// Detail database sengaja tidak dikirim ke browser.
	_ = action
	_ = err
	errx.JSON(w, errx.InternalServerError("Terjadi kesalahan pada server"))
}
