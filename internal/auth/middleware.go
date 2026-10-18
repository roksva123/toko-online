package auth

import (
	"context"
	"net/http"
	"strings"

	errx "github.com/example/toko-online/internal/httpx/error"
)

type ctxKey struct{}

// RequireAuth memvalidasi header "Authorization: Bearer <access_token>".
func (m *TokenManager) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		raw, found := strings.CutPrefix(header, "Bearer ")
		if !found || raw == "" {
			errx.JSON(w, errx.Unauthorized("Token akses tidak ditemukan"))
			return
		}

		claims, err := m.ParseAccessToken(raw)
		if err != nil {
			errx.JSON(w, errx.Unauthorized("Token akses tidak valid atau sudah kedaluwarsa"))
			return
		}

		ctx := context.WithValue(r.Context(), ctxKey{}, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireAdmin dipasang setelah RequireAuth.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if Role(r.Context()) != "admin" {
			errx.JSON(w, errx.Forbidden("Akses ditolak"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func UserID(ctx context.Context) string {
	if c, ok := ctx.Value(ctxKey{}).(*Claims); ok {
		return c.Subject
	}
	return ""
}

func Role(ctx context.Context) string {
	if c, ok := ctx.Value(ctxKey{}).(*Claims); ok {
		return c.Role
	}
	return ""
}