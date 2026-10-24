package shipping

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/example/toko-online/internal/httpx/response"
)

type ShippingRate struct {
	Service string `json:"service"`
	Cost    int64  `json:"cost"`
	ETD     string `json:"etd"`
}

type CalculateShippingRequest struct {
	OriginCityID      string `json:"origin_city_id"`
	DestinationCityID string `json:"destination_city_id"`
	Weight            int    `json:"weight"`
}

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) Mount(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Route("/shipping", func(r chi.Router) {
		r.Use(authMiddleware)
		r.Post("/calculate", h.CalculateShipping)
	})
}

// CalculateShippingHandler memberikan hasil simulasi biaya pengiriman.
func (h *Handler) CalculateShipping(w http.ResponseWriter, r *http.Request) {
	// Di sini nanti bisa diintegrasikan dengan API RajaOngkir sebenarnya.
	// Untuk saat ini, kita berikan data dummy.

	rates := []ShippingRate{
		{Service: "JNE Reguler", Cost: 20000, ETD: "2-3 hari"},
		{Service: "JNE Express", Cost: 35000, ETD: "1-2 hari"},
		{Service: "SiCepat Ekspres", Cost: 18000, ETD: "2-3 hari"},
	}

	response.JSON(w, http.StatusOK, rates, nil)
}
