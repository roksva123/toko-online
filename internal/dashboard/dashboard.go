package dashboard

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/toko-online/internal/auth"
	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

var orderStatuses = []string{
	"pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "expired",
}

// ---------- Tipe ----------

type ProductStats struct {
	Total  int64 `json:"total"`
	Active int64 `json:"active"`
}

type OrderStats struct {
	Total                       int64            `json:"total"`
	ByStatus                    map[string]int64 `json:"by_status"`
	WaitingPaymentConfirmation  int64            `json:"waiting_payment_confirmation"`
}

type RevenueStats struct {
	Today int64 `json:"today"`
	Month int64 `json:"month"`
}

type StockAlert struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	VariantName string `json:"variant_name"`
	SKU         string `json:"sku"`
	Stock       int    `json:"stock"`
}

type RecentOrder struct {
	ID           string    `json:"id"`
	OrderNumber  string    `json:"order_number"`
	CustomerName string    `json:"customer_name"`
	Status       string    `json:"status"`
	Total        int64     `json:"total"`
	CreatedAt    time.Time `json:"created_at"`
}

type Summary struct {
	Products          ProductStats  `json:"products"`
	Categories        int64         `json:"categories"`
	Customers         int64         `json:"customers"`
	Orders            OrderStats    `json:"orders"`
	Revenue           RevenueStats  `json:"revenue"`
	LowStockThreshold int           `json:"low_stock_threshold"`
	LowStockTotal     int64         `json:"low_stock_total"`
	LowStock          []StockAlert  `json:"low_stock"`
	RecentOrders      []RecentOrder `json:"recent_orders"`
}

// ---------- Handler ----------

type Handler struct {
	pool              *pgxpool.Pool
	lowStockThreshold int
}

func NewHandler(pool *pgxpool.Pool, lowStockThreshold int) *Handler {
	return &Handler{pool: pool, lowStockThreshold: lowStockThreshold}
}

// Mount memasang GET /dashboard/summary (khusus admin) di router /api/v1.
// Sengaja tidak memakai prefix /admin supaya tidak bentrok dengan router admin katalog.
func (h *Handler) Mount(r chi.Router, requireAuth func(http.Handler) http.Handler) {
	r.With(requireAuth, auth.RequireAdmin).Get("/dashboard/summary", h.Summary)
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	s, err := h.load(r.Context())
	if err != nil {
		slog.Error("dashboard: load summary", slog.Any("error", err))
		errx.JSON(w, errx.InternalServerError("Terjadi kesalahan pada server"))
		return
	}
	response.JSON(w, http.StatusOK, s, nil)
}

func (h *Handler) load(ctx context.Context) (*Summary, error) {
	s := &Summary{
		LowStockThreshold: h.lowStockThreshold,
		Orders:            OrderStats{ByStatus: map[string]int64{}},
		LowStock:          []StockAlert{},
		RecentOrders:      []RecentOrder{},
	}
	for _, st := range orderStatuses {
		s.Orders.ByStatus[st] = 0
	}

	// Produk
	if err := h.pool.QueryRow(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM products`,
	).Scan(&s.Products.Total, &s.Products.Active); err != nil {
		return nil, err
	}

	// Kategori dan pelanggan
	if err := h.pool.QueryRow(ctx, `SELECT COUNT(*) FROM categories`).Scan(&s.Categories); err != nil {
		return nil, err
	}
	if err := h.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE role = 'customer'`).Scan(&s.Customers); err != nil {
		return nil, err
	}

	// Pesanan per status
	rows, err := h.pool.Query(ctx, `SELECT status, COUNT(*) FROM orders GROUP BY status`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			rows.Close()
			return nil, err
		}
		s.Orders.ByStatus[status] = count
		s.Orders.Total += count
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Pembayaran yang menunggu konfirmasi admin
	if err := h.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM payments WHERE status = 'waiting_confirmation'`,
	).Scan(&s.Orders.WaitingPaymentConfirmation); err != nil {
		return nil, err
	}

	// Pendapatan (pesanan yang sudah dibayar), batas hari dan bulan mengikuti WIB
	if err := h.pool.QueryRow(ctx, `
		SELECT
		  COALESCE(SUM(total) FILTER (
		    WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'
		  ), 0)::bigint,
		  COALESCE(SUM(total) FILTER (
		    WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'
		  ), 0)::bigint
		FROM orders
		WHERE status IN ('paid', 'processing', 'shipped', 'delivered')`,
	).Scan(&s.Revenue.Today, &s.Revenue.Month); err != nil {
		return nil, err
	}

	// Stok menipis (varian aktif dari produk aktif)
	if err := h.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM product_variants v
		JOIN products p ON p.id = v.product_id
		WHERE v.is_active AND p.is_active AND v.stock <= $1`,
		h.lowStockThreshold,
	).Scan(&s.LowStockTotal); err != nil {
		return nil, err
	}

	srows, err := h.pool.Query(ctx, `
		SELECT p.id::text, p.name, v.name, v.sku, v.stock
		FROM product_variants v
		JOIN products p ON p.id = v.product_id
		WHERE v.is_active AND p.is_active AND v.stock <= $1
		ORDER BY v.stock, p.name, v.name
		LIMIT 8`,
		h.lowStockThreshold)
	if err != nil {
		return nil, err
	}
	for srows.Next() {
		var a StockAlert
		if err := srows.Scan(&a.ProductID, &a.ProductName, &a.VariantName, &a.SKU, &a.Stock); err != nil {
			srows.Close()
			return nil, err
		}
		s.LowStock = append(s.LowStock, a)
	}
	srows.Close()
	if err := srows.Err(); err != nil {
		return nil, err
	}

	// Pesanan terbaru
	orows, err := h.pool.Query(ctx, `
		SELECT o.id::text, o.order_number, u.name, o.status, o.total, o.created_at
		FROM orders o
		JOIN users u ON u.id = o.user_id
		ORDER BY o.created_at DESC
		LIMIT 5`)
	if err != nil {
		return nil, err
	}
	defer orows.Close()
	for orows.Next() {
		var o RecentOrder
		if err := orows.Scan(&o.ID, &o.OrderNumber, &o.CustomerName, &o.Status, &o.Total, &o.CreatedAt); err != nil {
			return nil, err
		}
		s.RecentOrders = append(s.RecentOrders, o)
	}
	return s, orows.Err()
}