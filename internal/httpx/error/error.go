package errx

import (
	"encoding/json"
	"net/http"
)

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

type APIError struct {
	Code       string
	Message    string
	StatusCode int
	Details    map[string]interface{}
}

func (e *APIError) Error() string {
	return e.Message
}

func New(code, message string, statusCode int) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
	}
}

func (e *APIError) WithDetails(details map[string]interface{}) *APIError {
	e.Details = details
	return e
}

func JSON(w http.ResponseWriter, err *APIError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.StatusCode)

	resp := ErrorResponse{
		Error: ErrorDetail{
			Code:    err.Code,
			Message: err.Message,
			Details: err.Details,
		},
	}

	json.NewEncoder(w).Encode(resp)
}

// Common errors
func BadRequest(message string) *APIError {
	return New("BAD_REQUEST", message, http.StatusBadRequest)
}

func Unauthorized(message string) *APIError {
	return New("UNAUTHORIZED", message, http.StatusUnauthorized)
}

func Forbidden(message string) *APIError {
	return New("FORBIDDEN", message, http.StatusForbidden)
}

func NotFound(message string) *APIError {
	return New("NOT_FOUND", message, http.StatusNotFound)
}

func Conflict(message string) *APIError {
	return New("CONFLICT", message, http.StatusConflict)
}

func InternalServerError(message string) *APIError {
	return New("INTERNAL_SERVER_ERROR", message, http.StatusInternalServerError)
}

func ValidationError(message string) *APIError {
	return New("VALIDATION_ERROR", message, http.StatusBadRequest)
}
