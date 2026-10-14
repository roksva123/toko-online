package response

import (
	"encoding/json"
	"net/http"
)

type SuccessResponse struct {
	Data interface{} `json:"data"`
	Meta *Meta       `json:"meta,omitempty"`
}

type Meta struct {
	Page  int   `json:"page,omitempty"`
	Limit int   `json:"limit,omitempty"`
	Total int64 `json:"total,omitempty"`
}

func JSON(w http.ResponseWriter, statusCode int, data interface{}, meta *Meta) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	resp := SuccessResponse{
		Data: data,
		Meta: meta,
	}

	json.NewEncoder(w).Encode(resp)
}

func Empty(w http.ResponseWriter, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
}

func JSONWithMeta(w http.ResponseWriter, statusCode int, data interface{}, page, limit int, total int64) {
	JSON(w, statusCode, data, &Meta{
		Page:  page,
		Limit: limit,
		Total: total,
	})
}
