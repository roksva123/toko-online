package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/toko-online/internal/auth"
	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

type ProductReview struct {
	ID        string    `json:"id"`
	Rating    int       `json:"rating"`
	Comment   string    `json:"comment"`
	UserName  string    `json:"user_name"`
	CreatedAt time.Time `json:"created_at"`
}

type reviewInput struct {
	OrderItemID string `json:"order_item_id"`
	Rating      int    `json:"rating"`
	Comment     string `json:"comment"`
}

func (h *Handler) MountReviews(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.Get("/products/{id}/reviews", h.ListReviews)
	r.With(requireAuth).Post("/products/{id}/reviews", h.CreateReview)
}

func (h *Handler) ListReviews(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	if _, err := uuid.Parse(productID); err != nil {
		errX := errx.NotFound("Produk tidak ditemukan")
		errx.JSON(w, errX)
		return
	}

	rows, err := h.store.pool.Query(r.Context(), `
		SELECT pr.id::text, pr.rating, pr.comment, u.name, pr.created_at
		FROM product_reviews pr
		JOIN users u ON u.id = pr.user_id
		WHERE pr.product_id = $1::uuid
		ORDER BY pr.created_at DESC`, productID)
	if err != nil {
		internalError(w, "list product reviews", err)
		return
	}
	defer rows.Close()

	reviews := make([]ProductReview, 0)
	for rows.Next() {
		var review ProductReview
		if err := rows.Scan(&review.ID, &review.Rating, &review.Comment, &review.UserName, &review.CreatedAt); err != nil {
			internalError(w, "read product reviews", err)
			return
		}
		reviews = append(reviews, review)
	}
	if err := rows.Err(); err != nil {
		internalError(w, "read product reviews", err)
		return
	}
	response.JSON(w, http.StatusOK, reviews, nil)
}

func (h *Handler) CreateReview(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	if _, err := uuid.Parse(productID); err != nil {
		errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		return
	}

	var in reviewInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		errx.JSON(w, errx.BadRequest("Data ulasan tidak valid"))
		return
	}
	in.Comment = strings.TrimSpace(in.Comment)
	if in.Rating < 1 || in.Rating > 5 {
		errx.JSON(w, errx.ValidationError("Rating harus antara 1 sampai 5"))
		return
	}
	if len([]rune(in.Comment)) > 1000 {
		errx.JSON(w, errx.ValidationError("Ulasan maksimal 1000 karakter"))
		return
	}

	orderItemID := strings.TrimSpace(in.OrderItemID)
	if _, err := uuid.Parse(orderItemID); err != nil {
		errx.JSON(w, errx.ValidationError("Item pesanan tidak valid"))
		return
	}

	var review ProductReview
	err := h.store.pool.QueryRow(r.Context(), `
		INSERT INTO product_reviews (product_id, order_id, order_item_id, user_id, rating, comment)
		SELECT pv.product_id, o.id, oi.id, o.user_id, $4, $5
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		JOIN product_variants pv ON pv.id = oi.variant_id
		WHERE oi.id = $1::uuid
		  AND pv.product_id = $2::uuid
		  AND o.user_id = $3::uuid
		  AND o.status = 'delivered'
		RETURNING id::text, rating, comment,
		          (SELECT name FROM users WHERE id = user_id), created_at`,
		orderItemID, productID, auth.UserID(r.Context()), in.Rating, in.Comment).
		Scan(&review.ID, &review.Rating, &review.Comment, &review.UserName, &review.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		errx.JSON(w, errx.Conflict("Produk hanya dapat dinilai setelah pesanan diterima"))
		return
	}
	if err != nil {
		if pgErr := pgError(err); pgErr != nil && pgErr.Code == "23505" {
			errx.JSON(w, errx.Conflict("Item pesanan ini sudah dinilai"))
			return
		}
		internalError(w, "create product review", err)
		return
	}
	response.JSON(w, http.StatusCreated, review, nil)
}

func (s *Store) ProductReviewSummary(ctx context.Context, productID string) (float64, int64, error) {
	var average float64
	var total int64
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(rating), 0), COUNT(*)
		FROM product_reviews WHERE product_id = $1::uuid`, productID).Scan(&average, &total)
	return average, total, err
}
