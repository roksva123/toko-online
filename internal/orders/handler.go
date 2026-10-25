package orders

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/toko-online/internal/auth"
	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

var validStatuses = map[string]bool{
	"pending_payment": true,
	"paid":            true,
	"processing":      true,
	"shipped":         true,
	"delivered":       true,
	"cancelled":       true,
	"expired":         true,
}

type Handler struct {
	pool *pgxpool.Pool
}

func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

const (
	dummyShippingCost   int64 = 15000
	maxPaymentProofSize       = 5 << 20 // 5 MiB
	paymentUploadDir          = "uploads"
)

var allowedPaymentProofTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// createOrderRequest berisi data checkout untuk sementara. Ongkir tetap dihitung
// di server agar total pesanan tidak bisa dimanipulasi dari browser.
type createOrderRequest struct {
	AddressID    string           `json:"address_id"`
	Courier      string           `json:"courier"`
	Service      string           `json:"service"`
	ShippingCost int64            `json:"shipping_cost"`
	Notes        string           `json:"notes"`
	Items        []orderItemInput `json:"items"`
}

type orderItemInput struct {
	VariantID string `json:"variant_id"`
	Quantity  int    `json:"quantity"`
}

type createdOrder struct {
	ID string `json:"id"`
}

type orderPayment struct {
	ID              string    `json:"id"`
	Status          string    `json:"status"`
	AmountDue       int64     `json:"amount_due"`
	ProofImageURL   string    `json:"proof_image_url,omitempty"`
	SenderName      string    `json:"sender_name,omitempty"`
	RejectionReason string    `json:"rejection_reason,omitempty"`
	ExpiresAt       time.Time `json:"expires_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type customerOrderItem struct {
	ID          string `json:"id"`
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	VariantName string `json:"variant_name"`
	Quantity    int    `json:"quantity"`
	Price       int64  `json:"price"`
	Reviewed    bool   `json:"reviewed"`
}

type customerOrderAddress struct {
	RecipientName string `json:"recipient_name"`
	Address       string `json:"address"`
	City          string `json:"city"`
}

type customerOrderShipping struct {
	Courier    string `json:"courier"`
	Service    string `json:"service"`
	ResiNumber string `json:"resi_number,omitempty"`
}

type customerOrderTracking struct {
	Status      string    `json:"status"`
	Description string    `json:"description"`
	Location    string    `json:"location,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
}

type customerOrder struct {
	ID           string                  `json:"id"`
	OrderNumber  string                  `json:"order_number"`
	Status       string                  `json:"status"`
	Subtotal     int64                   `json:"subtotal"`
	ShippingCost int64                   `json:"shipping_cost"`
	Total        int64                   `json:"total"`
	Items        []customerOrderItem     `json:"items"`
	Address      customerOrderAddress    `json:"address"`
	Shipping     customerOrderShipping   `json:"shipping"`
	Tracking     []customerOrderTracking `json:"tracking"`
	CreatedAt    time.Time               `json:"created_at"`
	Payment      *orderPayment           `json:"payment,omitempty"`
}

type customerOrderListItem struct {
	ID          string          `json:"id"`
	OrderNumber string          `json:"order_number"`
	Total       int64           `json:"total"`
	Status      string          `json:"status"`
	CreatedAt   time.Time       `json:"created_at"`
	Items       json.RawMessage `json:"items"`
}

type AdminOrder struct {
	ID             string    `json:"id"`
	OrderNumber    string    `json:"order_number"`
	CustomerName   string    `json:"customer_name"`
	CustomerEmail  string    `json:"customer_email"`
	Status         string    `json:"status"`
	Subtotal       int64     `json:"subtotal"`
	ShippingCost   int64     `json:"shipping_cost"`
	Total          int64     `json:"total"`
	Courier        string    `json:"courier"`
	CourierService string    `json:"courier_service"`
	TrackingNumber string    `json:"tracking_number"`
	CreatedAt      time.Time `json:"created_at"`
	ItemCount      int64     `json:"item_count"`
}

type AdminPayment struct {
	ID              string    `json:"id"`
	OrderID         string    `json:"order_id"`
	OrderNumber     string    `json:"order_number"`
	CustomerName    string    `json:"customer_name"`
	CustomerEmail   string    `json:"customer_email"`
	Amount          int64     `json:"amount"`
	AmountDue       int64     `json:"amount_due"`
	Status          string    `json:"status"`
	ProofImageURL   string    `json:"proof_image_url,omitempty"`
	SenderName      string    `json:"sender_name,omitempty"`
	RejectionReason string    `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	ExpiresAt       time.Time `json:"expires_at"`
}

type rejectPaymentRequest struct {
	Reason string `json:"reason"`
}

type orderFilter struct {
	Status string
	Query  string
	Page   int
	Limit  int
}

func (h *Handler) Mount(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.With(requireAuth).Post("/orders", h.Create)
	r.With(requireAuth).Get("/orders", h.ListCustomer)
	r.With(requireAuth).Get("/orders/{id}", h.Get)
	r.With(requireAuth).Post("/orders/{id}/payment/proof", h.UploadPaymentProof)
}

func (h *Handler) MountAdmin(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.Route("/admin/orders", func(r chi.Router) {
		r.Use(requireAuth)
		r.Use(auth.RequireAdmin)
		r.Get("/", h.List)
		r.Patch("/{id}/status", h.UpdateStatus)
	})
	r.Route("/admin/payments", func(r chi.Router) {
		r.Use(requireAuth)
		r.Use(auth.RequireAdmin)
		r.Get("/", h.ListPayments)
		r.Post("/{id}/confirm", h.ConfirmPayment)
		r.Post("/{id}/reject", h.RejectPayment)
	})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var in createOrderRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		errx.JSON(w, errx.BadRequest("Data pesanan tidak valid"))
		return
	}
	in.AddressID = strings.TrimSpace(in.AddressID)
	in.Courier = strings.TrimSpace(in.Courier)
	in.Service = strings.TrimSpace(in.Service)
	in.Notes = strings.TrimSpace(in.Notes)
	if _, err := uuid.Parse(in.AddressID); err != nil {
		errx.JSON(w, errx.ValidationError("Alamat pengiriman wajib dipilih"))
		return
	}
	if in.Courier == "" || in.Service == "" {
		errx.JSON(w, errx.ValidationError("Pilihan pengiriman wajib dipilih"))
		return
	}
	if len(in.Notes) > 1000 {
		errx.JSON(w, errx.ValidationError("Catatan maksimal 1000 karakter"))
		return
	}

	ctx := r.Context()
	userID := auth.UserID(ctx)
	var orderID string
	var orderNumber string
	var subtotal int64

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membuat pesanan"))
		return
	}
	defer tx.Rollback(ctx)

	var addressOK bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE id = $1::uuid AND user_id = $2::uuid)`, in.AddressID, userID).Scan(&addressOK); err != nil || !addressOK {
		errx.JSON(w, errx.NotFound("Alamat pengiriman tidak ditemukan"))
		return
	}

	if len(in.Items) == 0 {
		errx.JSON(w, errx.ValidationError("Keranjang kosong"))
		return
	}
	itemsJSON, err := json.Marshal(in.Items)
	if err != nil {
		errx.JSON(w, errx.BadRequest("Item pesanan tidak valid"))
		return
	}
	rows, err := tx.Query(ctx, `
		SELECT pv.id::text, i.quantity, p.name, pv.name, pv.sku, pv.price
		FROM jsonb_to_recordset($1::jsonb) AS i(variant_id text, quantity int)
		JOIN product_variants pv ON pv.id = i.variant_id::uuid
		JOIN products p ON p.id = pv.product_id
		WHERE pv.is_active AND p.is_active
		FOR UPDATE OF pv`, itemsJSON)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membaca keranjang"))
		return
	}
	type cartRow struct {
		variantID, productName, variantName, sku string
		quantity                                 int
		price                                    int64
	}
	cart := make([]cartRow, 0)
	for rows.Next() {
		var item cartRow
		if err := rows.Scan(&item.variantID, &item.quantity, &item.productName, &item.variantName, &item.sku, &item.price); err != nil {
			rows.Close()
			errx.JSON(w, errx.InternalServerError("Gagal membaca keranjang"))
			return
		}
		cart = append(cart, item)
		subtotal += item.price * int64(item.quantity)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(cart) == 0 {
		errx.JSON(w, errx.ValidationError("Keranjang kosong"))
		return
	}

	// Tarif dummy fase awal: reguler Rp15.000, express Rp30.000.
	shippingCost := dummyShippingCost
	if strings.EqualFold(in.Service, "Express") {
		shippingCost = 30000
	}
	total := subtotal + shippingCost
	for _, item := range cart {
		tag, err := tx.Exec(ctx, `
			UPDATE product_variants
			SET stock = stock - $2, updated_at = NOW()
			WHERE id = $1::uuid AND stock >= $2`, item.variantID, item.quantity)
		if err != nil {
			errx.JSON(w, errx.InternalServerError("Gagal mengurangi stok"))
			return
		}
		if tag.RowsAffected() == 0 {
			errx.JSON(w, errx.ValidationError("Stok produk tidak mencukupi"))
			return
		}
	}

	addressJSON := `json_build_object('label', a.label, 'recipient_name', a.recipient, 'phone', a.phone, 'address', a.street, 'district', a.district, 'city', a.city, 'province', a.province, 'postal_code', a.postal_code)`
	if err := tx.QueryRow(ctx, `
		INSERT INTO orders (order_number, user_id, subtotal, shipping_cost, total, note, shipping_address, courier, courier_service)
		SELECT 'ORD-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6), $1::uuid, $2, $3, $4, $5, `+addressJSON+`, $6, $7
		FROM addresses a WHERE a.id = $8::uuid
		RETURNING id::text, order_number`, userID, subtotal, shippingCost, total, in.Notes, in.Courier, in.Service, in.AddressID).Scan(&orderID, &orderNumber); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal menyimpan pesanan"))
		return
	}
	// Serialkan alokasi kode unik supaya dua checkout bersamaan tidak memilih
	// amount_due yang sama sebelum unique index memeriksanya.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(2147483647::bigint)`); err != nil {
		slog.Error("failed to lock payment code allocation", slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Gagal menyiapkan pembayaran"))
		return
	}
	paymentTag, err := tx.Exec(ctx, `
		INSERT INTO payments (order_id, amount, unique_code, amount_due, expires_at)
		SELECT $1::uuid, $2::bigint, allocation.code::int,
		       $2::bigint + allocation.code::bigint,
		       NOW() + INTERVAL '24 hours'
		FROM (
			SELECT codes.code
			FROM generate_series(1, 999) AS codes(code)
			WHERE NOT EXISTS (
				SELECT 1
				FROM payments p
				WHERE p.amount_due = $2::bigint + codes.code::bigint
				  AND p.status IN ('pending', 'waiting_confirmation')
			)
			ORDER BY codes.code
			LIMIT 1
		) AS allocation`, orderID, total)
	if err != nil {
		slog.Error("failed to create payment", slog.String("order_id", orderID), slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Gagal menyiapkan pembayaran"))
		return
	}
	if paymentTag.RowsAffected() == 0 {
		errx.JSON(w, errx.Conflict("Nominal pembayaran sedang penuh, coba lagi"))
		return
	}
	for _, item := range cart {
		if _, err := tx.Exec(ctx, `INSERT INTO order_items (order_id, variant_id, product_name, variant_name, sku, price, quantity) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)`, orderID, item.variantID, item.productName, item.variantName, item.sku, item.price, item.quantity); err != nil {
			errX := errx.InternalServerError("Gagal menyimpan item pesanan")
			errx.JSON(w, errX)
			return
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1::uuid)`, userID); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal mengosongkan keranjang"))
		return
	}
	if err := tx.Commit(ctx); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal menyelesaikan pesanan"))
		return
	}
	response.JSON(w, http.StatusCreated, createdOrder{ID: orderID}, nil)
}

func (h *Handler) UploadPaymentProof(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")
	if _, err := uuid.Parse(orderID); err != nil {
		errx.JSON(w, errx.NotFound("Pesanan tidak ditemukan"))
		return
	}

	senderName := strings.TrimSpace(r.FormValue("sender_name"))
	if senderName == "" {
		errx.JSON(w, errx.ValidationError("Nama pengirim wajib diisi"))
		return
	}
	if len(senderName) > 255 {
		errx.JSON(w, errx.ValidationError("Nama pengirim maksimal 255 karakter"))
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxPaymentProofSize+1024)
	if err := r.ParseMultipartForm(maxPaymentProofSize); err != nil {
		errx.JSON(w, errx.BadRequest("Ukuran bukti pembayaran maksimal 5 MB"))
		return
	}
	file, _, err := r.FormFile("proof")
	if err != nil {
		errx.JSON(w, errx.ValidationError("Pilih bukti pembayaran terlebih dahulu"))
		return
	}
	defer file.Close()

	header := make([]byte, 512)
	n, err := file.Read(header)
	if err != nil && err != io.EOF {
		errx.JSON(w, errx.BadRequest("Bukti pembayaran tidak dapat dibaca"))
		return
	}
	contentType := http.DetectContentType(header[:n])
	extension, allowed := allowedPaymentProofTypes[contentType]
	if !allowed {
		errx.JSON(w, errx.ValidationError("Gunakan bukti pembayaran JPG, PNG, atau WebP"))
		return
	}

	storageKey := filepath.ToSlash(filepath.Join("payments", orderID, uuid.NewString()+extension))
	filePath := filepath.Join(paymentUploadDir, filepath.FromSlash(storageKey))
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		slog.Error("failed to create payment proof directory", slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Gagal menyimpan bukti pembayaran"))
		return
	}
	out, err := os.Create(filePath)
	if err != nil {
		slog.Error("failed to create payment proof file", slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Gagal menyimpan bukti pembayaran"))
		return
	}
	_, copyErr := io.Copy(out, io.MultiReader(bytes.NewReader(header[:n]), file))
	closeErr := out.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(filePath)
		slog.Error("failed to write payment proof file", slog.Any("copy_error", copyErr), slog.Any("close_error", closeErr))
		errx.JSON(w, errx.InternalServerError("Gagal menyimpan bukti pembayaran"))
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		_ = os.Remove(filePath)
		errx.JSON(w, errx.InternalServerError("Gagal memproses bukti pembayaran"))
		return
	}
	defer tx.Rollback(ctx)

	var paymentStatus string
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT p.status, p.expires_at
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		WHERE p.order_id = $1::uuid AND o.user_id = $2::uuid
		FOR UPDATE`, orderID, auth.UserID(ctx)).Scan(&paymentStatus, &expiresAt)
	if err != nil {
		_ = os.Remove(filePath)
		if err == pgx.ErrNoRows {
			errx.JSON(w, errx.NotFound("Pesanan atau pembayaran tidak ditemukan"))
		} else {
			slog.Error("failed to find payment for proof", slog.Any("error", err))
			errx.JSON(w, errx.InternalServerError("Gagal memproses bukti pembayaran"))
		}
		return
	}
	if paymentStatus == "pending" && !expiresAt.After(time.Now()) {
		_, _ = tx.Exec(ctx, `UPDATE payments SET status = 'expired', updated_at = NOW() WHERE order_id = $1::uuid`, orderID)
		_ = os.Remove(filePath)
		errx.JSON(w, errx.Conflict("Waktu pembayaran sudah berakhir"))
		return
	}
	if paymentStatus != "pending" && paymentStatus != "rejected" {
		_ = os.Remove(filePath)
		switch paymentStatus {
		case "waiting_confirmation":
			errx.JSON(w, errx.Conflict("Bukti pembayaran sedang menunggu konfirmasi admin"))
		case "paid":
			errx.JSON(w, errx.Conflict("Pembayaran sudah dikonfirmasi"))
		case "expired":
			errx.JSON(w, errx.Conflict("Waktu pembayaran sudah berakhir"))
		default:
			errx.JSON(w, errx.Conflict("Status pembayaran tidak dapat diubah"))
		}
		return
	}

	if _, err := tx.Exec(ctx, `
		UPDATE payments
		SET proof_key = $2,
		    sender_name = $3,
		    reject_reason = NULL,
		    status = 'waiting_confirmation',
		    updated_at = NOW()
		WHERE order_id = $1::uuid`, orderID, storageKey, senderName); err != nil {
		_ = os.Remove(filePath)
		slog.Error("failed to update payment proof", slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Gagal memperbarui pembayaran"))
		return
	}
	if err := tx.Commit(ctx); err != nil {
		_ = os.Remove(filePath)
		errx.JSON(w, errx.InternalServerError("Gagal menyelesaikan upload bukti pembayaran"))
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"status":          "waiting_confirmation",
		"proof_key":       storageKey,
		"proof_image_url": "/uploads/" + storageKey,
	}, nil)
}

func (h *Handler) ListPayments(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "waiting_confirmation"
	}
	if status != "pending" && status != "waiting_confirmation" && status != "paid" && status != "rejected" && status != "expired" {
		errx.JSON(w, errx.ValidationError("Status pembayaran tidak valid"))
		return
	}

	rows, err := h.pool.Query(r.Context(), `
		SELECT p.id::text, p.order_id::text, o.order_number, u.name, u.email,
		       p.amount, p.amount_due, p.status, COALESCE(p.proof_key, ''),
		       COALESCE(p.sender_name, ''), COALESCE(p.reject_reason, ''),
		       p.created_at, p.expires_at
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		JOIN users u ON u.id = o.user_id
		WHERE p.status = $1
		ORDER BY p.created_at DESC`, status)
	if err != nil {
		slog.Error("failed to list payments", slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Gagal memuat pembayaran"))
		return
	}
	defer rows.Close()

	payments := make([]AdminPayment, 0)
	for rows.Next() {
		var payment AdminPayment
		var proofKey string
		if err := rows.Scan(
			&payment.ID, &payment.OrderID, &payment.OrderNumber, &payment.CustomerName,
			&payment.CustomerEmail, &payment.Amount, &payment.AmountDue, &payment.Status,
			&proofKey, &payment.SenderName, &payment.RejectionReason,
			&payment.CreatedAt, &payment.ExpiresAt,
		); err != nil {
			errx.JSON(w, errx.InternalServerError("Gagal membaca pembayaran"))
			return
		}
		if proofKey != "" {
			payment.ProofImageURL = "/uploads/" + strings.TrimPrefix(proofKey, "/")
		}
		payments = append(payments, payment)
	}
	if err := rows.Err(); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membaca pembayaran"))
		return
	}
	response.JSON(w, http.StatusOK, payments, nil)
}

func (h *Handler) ConfirmPayment(w http.ResponseWriter, r *http.Request) {
	paymentID := chi.URLParam(r, "id")
	if _, err := uuid.Parse(paymentID); err != nil {
		errx.JSON(w, errx.NotFound("Pembayaran tidak ditemukan"))
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal memproses pembayaran"))
		return
	}
	defer tx.Rollback(ctx)

	var orderID string
	var status string
	err = tx.QueryRow(ctx, `
		SELECT order_id::text, status
		FROM payments
		WHERE id = $1::uuid
		FOR UPDATE`, paymentID).Scan(&orderID, &status)
	if err == pgx.ErrNoRows {
		errx.JSON(w, errx.NotFound("Pembayaran tidak ditemukan"))
		return
	}
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membaca pembayaran"))
		return
	}
	if status != "waiting_confirmation" {
		errx.JSON(w, errx.Conflict("Pembayaran belum menunggu konfirmasi"))
		return
	}
	if _, err := tx.Exec(ctx, `
		UPDATE payments
		SET status = 'paid', paid_at = NOW(), confirmed_by = $2::uuid, updated_at = NOW()
		WHERE id = $1::uuid`, paymentID, auth.UserID(ctx)); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal mengonfirmasi pembayaran"))
		return
	}
	if _, err := tx.Exec(ctx, `
		UPDATE orders
		SET status = 'paid', updated_at = NOW()
		WHERE id = $1::uuid AND status = 'pending_payment'`, orderID); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal memperbarui status pesanan"))
		return
	}
	if err := tx.Commit(ctx); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal menyelesaikan konfirmasi pembayaran"))
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "paid", "order_id": orderID}, nil)
}

func (h *Handler) RejectPayment(w http.ResponseWriter, r *http.Request) {
	paymentID := chi.URLParam(r, "id")
	if _, err := uuid.Parse(paymentID); err != nil {
		errx.JSON(w, errx.NotFound("Pembayaran tidak ditemukan"))
		return
	}
	var in rejectPaymentRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		errx.JSON(w, errx.BadRequest("Data penolakan tidak valid"))
		return
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.Reason == "" {
		errx.JSON(w, errx.ValidationError("Alasan penolakan wajib diisi"))
		return
	}
	if len(in.Reason) > 1000 {
		errx.JSON(w, errx.ValidationError("Alasan penolakan maksimal 1000 karakter"))
		return
	}

	tag, err := h.pool.Exec(r.Context(), `
		UPDATE payments
		SET status = 'rejected', reject_reason = $2, updated_at = NOW()
		WHERE id = $1::uuid AND status = 'waiting_confirmation'`, paymentID, in.Reason)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal menolak pembayaran"))
		return
	}
	if tag.RowsAffected() == 0 {
		errx.JSON(w, errx.Conflict("Pembayaran belum menunggu konfirmasi"))
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "rejected"}, nil)
}

func (h *Handler) ListCustomer(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	status := strings.TrimSpace(q.Get("status"))
	page := 1
	limit := 10
	if parsed, err := strconv.Atoi(q.Get("page")); err == nil && parsed > 0 {
		page = parsed
	}
	if parsed, err := strconv.Atoi(q.Get("limit")); err == nil && parsed > 0 {
		limit = min(parsed, 50)
	}
	if status != "" && !validStatuses[status] {
		errx.JSON(w, errx.ValidationError("Status pesanan tidak valid"))
		return
	}

	args := []any{auth.UserID(r.Context())}
	where := " WHERE o.user_id = $1::uuid"
	if status != "" {
		args = append(args, status)
		where += fmt.Sprintf(" AND o.status = $%d", len(args))
	}

	var total int64
	if err := h.pool.QueryRow(r.Context(), "SELECT COUNT(*) FROM orders o"+where, args...).Scan(&total); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal memuat pesanan"))
		return
	}

	args = append(args, limit, (page-1)*limit)
	rows, err := h.pool.Query(r.Context(), `
		SELECT o.id::text, o.order_number, o.total, o.status, o.created_at,
		       COALESCE(json_agg(json_build_object('product_name', oi.product_name, 'quantity', oi.quantity)
		         ORDER BY oi.created_at) FILTER (WHERE oi.id IS NOT NULL), '[]'::json)
		FROM orders o
		LEFT JOIN order_items oi ON oi.order_id = o.id`+where+fmt.Sprintf(
		` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args)), args...)
	if err != nil {
		slog.Error("failed to list customer orders", slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Gagal memuat pesanan"))
		return
	}
	defer rows.Close()

	items := make([]customerOrderListItem, 0)
	for rows.Next() {
		var item customerOrderListItem
		if err := rows.Scan(&item.ID, &item.OrderNumber, &item.Total, &item.Status, &item.CreatedAt, &item.Items); err != nil {
			errx.JSON(w, errx.InternalServerError("Gagal membaca pesanan"))
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membaca pesanan"))
		return
	}
	response.JSONWithMeta(w, http.StatusOK, items, page, limit, total)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		errx.JSON(w, errx.NotFound("Pesanan tidak ditemukan"))
		return
	}

	var order customerOrder
	var addressJSON []byte
	err := h.pool.QueryRow(r.Context(), `
		SELECT id::text, order_number, status, subtotal, shipping_cost, total,
		       shipping_address, COALESCE(courier, ''), COALESCE(courier_service, ''),
		       COALESCE(tracking_number, ''), created_at
		FROM orders WHERE id = $1::uuid AND user_id = $2::uuid`,
		id, auth.UserID(r.Context())).Scan(
		&order.ID, &order.OrderNumber, &order.Status, &order.Subtotal, &order.ShippingCost,
		&order.Total, &addressJSON, &order.Shipping.Courier, &order.Shipping.Service,
		&order.Shipping.ResiNumber, &order.CreatedAt)
	if err != nil {
		errx.JSON(w, errx.NotFound("Pesanan tidak ditemukan"))
		return
	}
	if err := json.Unmarshal(addressJSON, &order.Address); err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membaca alamat pesanan"))
		return
	}
	order.Items = make([]customerOrderItem, 0)
	itemRows, err := h.pool.Query(r.Context(), `
		SELECT oi.id::text, pv.product_id::text, oi.product_name, oi.variant_name, oi.quantity, oi.price,
		       EXISTS (SELECT 1 FROM product_reviews pr WHERE pr.order_item_id = oi.id)
		FROM order_items oi
		JOIN product_variants pv ON pv.id = oi.variant_id
		WHERE order_id = $1::uuid
		ORDER BY created_at, id`, id)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membaca item pesanan"))
		return
	}
	for itemRows.Next() {
		var item customerOrderItem
		if err := itemRows.Scan(&item.ID, &item.ProductID, &item.ProductName, &item.VariantName, &item.Quantity, &item.Price, &item.Reviewed); err != nil {
			itemRows.Close()
			errx.JSON(w, errx.InternalServerError("Gagal membaca item pesanan"))
			return
		}
		order.Items = append(order.Items, item)
	}
	if err := itemRows.Err(); err != nil {
		itemRows.Close()
		errx.JSON(w, errx.InternalServerError("Gagal membaca item pesanan"))
		return
	}
	itemRows.Close()
	order.Tracking = make([]customerOrderTracking, 0)
	trackingRows, err := h.pool.Query(r.Context(), `
		SELECT to_status, to_status, COALESCE(note, ''), created_at
		FROM order_status_history
		WHERE order_id = $1::uuid
		ORDER BY created_at, id`, id)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal membaca tracking pesanan"))
		return
	}
	for trackingRows.Next() {
		var tracking customerOrderTracking
		if err := trackingRows.Scan(&tracking.Status, &tracking.Description, &tracking.Location, &tracking.Timestamp); err != nil {
			trackingRows.Close()
			errx.JSON(w, errx.InternalServerError("Gagal membaca tracking pesanan"))
			return
		}
		order.Tracking = append(order.Tracking, tracking)
	}
	if err := trackingRows.Err(); err != nil {
		trackingRows.Close()
		errx.JSON(w, errx.InternalServerError("Gagal membaca tracking pesanan"))
		return
	}
	trackingRows.Close()

	var payment orderPayment
	err = h.pool.QueryRow(r.Context(), `
		SELECT id::text, status, amount_due, COALESCE(proof_key, ''), COALESCE(sender_name, ''),
		       COALESCE(reject_reason, ''), expires_at, created_at
		FROM payments WHERE order_id = $1::uuid`, id).Scan(
		&payment.ID, &payment.Status, &payment.AmountDue, &payment.ProofImageURL,
		&payment.SenderName, &payment.RejectionReason, &payment.ExpiresAt, &payment.CreatedAt)
	if payment.ProofImageURL != "" {
		payment.ProofImageURL = "/uploads/" + strings.TrimPrefix(payment.ProofImageURL, "/")
	}
	if err == nil {
		order.Payment = &payment
	}
	response.JSON(w, http.StatusOK, order, nil)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := orderFilter{Status: strings.TrimSpace(q.Get("status")), Query: strings.TrimSpace(q.Get("q")), Page: 1, Limit: 20}
	if page, err := strconv.Atoi(q.Get("page")); err == nil && page > 0 {
		f.Page = page
	}
	if limit, err := strconv.Atoi(q.Get("limit")); err == nil && limit > 0 {
		f.Limit = min(limit, 100)
	}
	if f.Status != "" && !validStatuses[f.Status] {
		errx.JSON(w, errx.ValidationError("Status pesanan tidak valid"))
		return
	}

	items, total, err := h.list(r.Context(), f)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal memuat pesanan"))
		return
	}
	response.JSONWithMeta(w, http.StatusOK, items, f.Page, f.Limit, total)
}

func (h *Handler) list(ctx context.Context, f orderFilter) ([]AdminOrder, int64, error) {
	conditions := make([]string, 0, 2)
	args := make([]any, 0, 4)
	if f.Status != "" {
		args = append(args, f.Status)
		conditions = append(conditions, fmt.Sprintf("o.status = $%d", len(args)))
	}
	if f.Query != "" {
		args = append(args, f.Query)
		conditions = append(conditions, fmt.Sprintf("(o.order_number ILIKE '%%' || $%d || '%%' OR u.name ILIKE '%%' || $%d || '%%' OR u.email ILIKE '%%' || $%d || '%%')", len(args), len(args), len(args)))
	}
	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}

	const joins = " FROM orders o JOIN users u ON u.id = o.user_id"
	var total int64
	if err := h.pool.QueryRow(ctx, "SELECT COUNT(*)"+joins+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, f.Limit, (f.Page-1)*f.Limit)
	query := `
		SELECT o.id::text, o.order_number, u.name, u.email, o.status, o.subtotal, o.shipping_cost, o.total,
		       COALESCE(o.courier, ''), COALESCE(o.courier_service, ''), COALESCE(o.tracking_number, ''),
		       o.created_at, COUNT(oi.id)
		 FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN order_items oi ON oi.order_id = o.id` + where + fmt.Sprintf(
		` GROUP BY o.id, u.name, u.email ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args))

	rows, err := h.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]AdminOrder, 0)
	for rows.Next() {
		var item AdminOrder
		if err := rows.Scan(&item.ID, &item.OrderNumber, &item.CustomerName, &item.CustomerEmail,
			&item.Status, &item.Subtotal, &item.ShippingCost, &item.Total, &item.Courier,
			&item.CourierService, &item.TrackingNumber, &item.CreatedAt, &item.ItemCount); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

type statusInput struct {
	Status         string `json:"status"`
	TrackingNumber string `json:"tracking_number"`
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		errx.JSON(w, errx.NotFound("Pesanan tidak ditemukan"))
		return
	}

	var in statusInput
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		errx.JSON(w, errx.BadRequest("Data status tidak valid"))
		return
	}
	in.Status = strings.TrimSpace(in.Status)
	in.TrackingNumber = strings.TrimSpace(in.TrackingNumber)
	if !validStatuses[in.Status] {
		errx.JSON(w, errx.ValidationError("Status pesanan tidak valid"))
		return
	}
	if in.Status == "shipped" && in.TrackingNumber == "" {
		errx.JSON(w, errx.ValidationError("Nomor resi wajib diisi saat pesanan dikirim"))
		return
	}

	tag, err := h.pool.Exec(r.Context(), `
		UPDATE orders
		SET status = $2,
		    tracking_number = CASE WHEN $3 = '' THEN tracking_number ELSE $3 END,
		    updated_at = NOW()
		WHERE id = $1::uuid`, id, in.Status, in.TrackingNumber)
	if err != nil {
		errx.JSON(w, errx.InternalServerError("Gagal memperbarui status pesanan"))
		return
	}
	if tag.RowsAffected() == 0 {
		errx.JSON(w, errx.NotFound("Pesanan tidak ditemukan"))
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"id": id, "status": in.Status}, nil)
}
