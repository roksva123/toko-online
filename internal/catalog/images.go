package catalog

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	errx "github.com/example/toko-online/internal/httpx/error"
	"github.com/example/toko-online/internal/httpx/response"
)

const maxProductImageSize = 5 << 20 // 5 MiB

var allowedProductImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type ProductImage struct {
	ID         string `json:"id"`
	StorageKey string `json:"storage_key"`
	URL        string `json:"url,omitempty"`
	SortOrder  int    `json:"sort_order"`
}

func (h *Handler) ListProductImages(w http.ResponseWriter, r *http.Request) {
	productID, ok := pathID(w, r)
	if !ok {
		return
	}
	images, err := h.store.ListProductImages(r.Context(), productID)
	if errors.Is(err, ErrNotFound) {
		errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "list product images", err)
		return
	}
	for i := range images {
		if h.storage != nil {
			images[i].URL = h.storage.PublicURL(images[i].StorageKey)
		}
	}
	response.JSON(w, http.StatusOK, images, nil)
}

func (h *Handler) UploadProductImage(w http.ResponseWriter, r *http.Request) {
	productID, ok := pathID(w, r)
	if !ok {
		return
	}
	if exists, err := h.store.ProductExists(r.Context(), productID); err != nil {
		internalError(w, "check product for image upload", err)
		return
	} else if !exists {
		errx.JSON(w, errx.NotFound("Produk tidak ditemukan"))
		return
	}

	if h.storage == nil {
		internalError(w, "initialize image storage", fmt.Errorf("storage is not configured"))
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxProductImageSize+1024)
	if err := r.ParseMultipartForm(maxProductImageSize); err != nil {
		errx.JSON(w, errx.BadRequest("Ukuran foto maksimal 5 MB"))
		return
	}
	file, _, err := r.FormFile("image")
	if err != nil {
		errx.JSON(w, validationErr(map[string]interface{}{"image": "Pilih file foto terlebih dahulu"}))
		return
	}
	defer file.Close()

	header := make([]byte, 512)
	n, err := file.Read(header)
	if err != nil && err != io.EOF {
		errx.JSON(w, errx.BadRequest("File foto tidak dapat dibaca"))
		return
	}
	contentType := http.DetectContentType(header[:n])
	extension, allowed := allowedProductImageTypes[contentType]
	if !allowed {
		errx.JSON(w, validationErr(map[string]interface{}{"image": "Gunakan foto JPG, PNG, atau WebP"}))
		return
	}

	storageKey := filepath.ToSlash(filepath.Join("products", productID, uuid.NewString()+extension))
	content := io.MultiReader(bytes.NewReader(header[:n]), file)
	if err := h.storage.Put(r.Context(), storageKey, content, -1, contentType); err != nil {
		internalError(w, "save image to storage", err)
		return
	}

	image, err := h.store.CreateProductImage(r.Context(), productID, storageKey)
	if err != nil {
		_ = h.storage.Delete(r.Context(), storageKey)
		internalError(w, "create product image", err)
		return
	}
	response.JSON(w, http.StatusCreated, image, nil)
}

func (h *Handler) DeleteProductImage(w http.ResponseWriter, r *http.Request) {
	productID, ok := pathID(w, r)
	if !ok {
		return
	}
	imageID := chi.URLParam(r, "imageID")
	if _, err := uuid.Parse(imageID); err != nil {
		errx.JSON(w, errx.NotFound("Foto tidak ditemukan"))
		return
	}
	storageKey, err := h.store.DeleteProductImage(r.Context(), productID, imageID)
	if errors.Is(err, pgx.ErrNoRows) {
		errx.JSON(w, errx.NotFound("Foto tidak ditemukan"))
		return
	}
	if err != nil {
		internalError(w, "delete product image", err)
		return
	}
	if h.storage != nil {
		if err := h.storage.Delete(r.Context(), storageKey); err != nil {
			internalError(w, "delete image from storage", err)
			return
		}
	}
	response.Empty(w, http.StatusNoContent)
}

func (s *Store) ProductExists(ctx context.Context, productID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM products WHERE id = $1::uuid)`, productID).Scan(&exists)
	return exists, err
}

func (s *Store) ListProductImages(ctx context.Context, productID string) ([]ProductImage, error) {
	if exists, err := s.ProductExists(ctx, productID); err != nil || !exists {
		if err != nil {
			return nil, err
		}
		return nil, ErrNotFound
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, storage_key, sort_order
		FROM product_images
		WHERE product_id = $1::uuid
		ORDER BY sort_order, created_at`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	images := make([]ProductImage, 0)
	for rows.Next() {
		var image ProductImage
		if err := rows.Scan(&image.ID, &image.StorageKey, &image.SortOrder); err != nil {
			return nil, err
		}
		images = append(images, image)
	}
	return images, rows.Err()
}

func (s *Store) CreateProductImage(ctx context.Context, productID, storageKey string) (*ProductImage, error) {
	var image ProductImage
	err := s.pool.QueryRow(ctx, `
		INSERT INTO product_images (product_id, storage_key, sort_order)
		VALUES ($1::uuid, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM product_images WHERE product_id = $1::uuid), 0))
		RETURNING id::text, storage_key, sort_order`, productID, storageKey).
		Scan(&image.ID, &image.StorageKey, &image.SortOrder)
	if err != nil {
		return nil, err
	}
	return &image, nil
}

func (s *Store) DeleteProductImage(ctx context.Context, productID, imageID string) (string, error) {
	var storageKey string
	err := s.pool.QueryRow(ctx, `
		DELETE FROM product_images
		WHERE id = $1::uuid AND product_id = $2::uuid
		RETURNING storage_key`, imageID, productID).Scan(&storageKey)
	return storageKey, err
}
