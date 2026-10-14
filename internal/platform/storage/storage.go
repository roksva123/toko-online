package storage

import (
	"context"
	"io"
)

// Storage interface mendefinisikan operasi penyimpanan file
type Storage interface {
	// Put menyimpan file ke storage
	Put(ctx context.Context, key string, data io.Reader, size int64, contentType string) error

	// Delete menghapus file dari storage
	Delete(ctx context.Context, key string) error

	// PublicURL mengembalikan URL publik untuk file (tanpa signature)
	PublicURL(key string) string

	// SignedURL mengembalikan URL dengan signature yang berlaku untuk durasi tertentu
	SignedURL(ctx context.Context, key string) (string, error)

	// Exists memeriksa apakah file ada
	Exists(ctx context.Context, key string) (bool, error)

	// Get mengambil file dari storage
	Get(ctx context.Context, key string) (io.ReadCloser, error)
}

// NoopStorage adalah implementasi storage yang tidak melakukan apa-apa (untuk testing)
type NoopStorage struct{}

func (s *NoopStorage) Put(ctx context.Context, key string, data io.Reader, size int64, contentType string) error {
	return nil
}

func (s *NoopStorage) Delete(ctx context.Context, key string) error {
	return nil
}

func (s *NoopStorage) PublicURL(key string) string {
	return ""
}

func (s *NoopStorage) SignedURL(ctx context.Context, key string) (string, error) {
	return "", nil
}

func (s *NoopStorage) Exists(ctx context.Context, key string) (bool, error) {
	return false, nil
}

func (s *NoopStorage) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	return nil, nil
}
