package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// SupabaseStorage stores objects through the Supabase Storage REST API.
// The service-role key must only be used by the backend and must never be sent
// to the browser.
type SupabaseStorage struct {
	baseURL    string
	publicURL  string
	bucket     string
	serviceKey string
	client     *http.Client
}

func NewSupabaseStorage(baseURL, publicURL, bucket, serviceKey string) *SupabaseStorage {
	baseURL = strings.TrimRight(baseURL, "/")
	if publicURL == "" {
		publicURL = baseURL
	}
	return &SupabaseStorage{
		baseURL:    baseURL,
		publicURL:  strings.TrimRight(publicURL, "/"),
		bucket:     bucket,
		serviceKey: serviceKey,
		client:     &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *SupabaseStorage) Put(ctx context.Context, key string, data io.Reader, size int64, contentType string) error {
	req, err := s.newRequest(ctx, http.MethodPost, s.objectURL(key), data)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "false")
	if size >= 0 {
		req.ContentLength = size
	}
	return s.do(req, http.StatusOK, http.StatusCreated)
}

func (s *SupabaseStorage) Delete(ctx context.Context, key string) error {
	payload, err := json.Marshal(map[string][]string{"prefixes": {key}})
	if err != nil {
		return fmt.Errorf("marshal delete request: %w", err)
	}
	req, err := s.newRequest(ctx, http.MethodPost, s.baseURL+"/storage/v1/object/remove/"+url.PathEscape(s.bucket), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	return s.do(req, http.StatusOK)
}

func (s *SupabaseStorage) PublicURL(key string) string {
	if key == "" {
		return ""
	}
	return s.publicURL + "/storage/v1/object/public/" + url.PathEscape(s.bucket) + "/" + escapeObjectKey(key)
}

func (s *SupabaseStorage) SignedURL(ctx context.Context, key string) (string, error) {
	payload, err := json.Marshal(map[string]int{"expiresIn": 3600})
	if err != nil {
		return "", fmt.Errorf("marshal signed URL request: %w", err)
	}
	req, err := s.newRequest(ctx, http.MethodPost, s.baseURL+"/storage/v1/object/sign/"+url.PathEscape(s.bucket)+"/"+escapeObjectKey(key), bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	var response struct {
		SignedURL string `json:"signedURL"`
	}
	if err := s.doJSON(req, &response); err != nil {
		return "", err
	}
	if response.SignedURL == "" {
		return "", fmt.Errorf("supabase returned an empty signed URL")
	}
	if strings.HasPrefix(response.SignedURL, "http://") || strings.HasPrefix(response.SignedURL, "https://") {
		return response.SignedURL, nil
	}
	return s.baseURL + "/" + strings.TrimLeft(response.SignedURL, "/"), nil
}

func (s *SupabaseStorage) Exists(ctx context.Context, key string) (bool, error) {
	req, err := s.newRequest(ctx, http.MethodHead, s.objectURL(key), nil)
	if err != nil {
		return false, err
	}
	response, err := s.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("check object existence: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return false, s.responseError(response)
	}
	return true, nil
}

func (s *SupabaseStorage) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	req, err := s.newRequest(ctx, http.MethodGet, s.objectURL(key), nil)
	if err != nil {
		return nil, err
	}
	response, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get object: %w", err)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		defer response.Body.Close()
		return nil, s.responseError(response)
	}
	return response.Body, nil
}

func (s *SupabaseStorage) objectURL(key string) string {
	return s.baseURL + "/storage/v1/object/" + url.PathEscape(s.bucket) + "/" + escapeObjectKey(key)
}

func (s *SupabaseStorage) newRequest(ctx context.Context, method, requestURL string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, fmt.Errorf("create storage request: %w", err)
	}
	req.Header.Set("apikey", s.serviceKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	return req, nil
}

func (s *SupabaseStorage) do(req *http.Request, accepted ...int) error {
	response, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("request supabase storage: %w", err)
	}
	defer response.Body.Close()
	for _, status := range accepted {
		if response.StatusCode == status {
			return nil
		}
	}
	return s.responseError(response)
}

func (s *SupabaseStorage) doJSON(req *http.Request, dst any) error {
	response, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("request supabase storage: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return s.responseError(response)
	}
	if err := json.NewDecoder(response.Body).Decode(dst); err != nil {
		return fmt.Errorf("decode supabase storage response: %w", err)
	}
	return nil
}

func (s *SupabaseStorage) responseError(response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 4<<10))
	message := strings.TrimSpace(string(body))
	if message == "" {
		message = response.Status
	}
	return fmt.Errorf("supabase storage returned %s: %s", response.Status, message)
}

func escapeObjectKey(key string) string {
	clean := path.Clean(strings.ReplaceAll(key, "\\", "/"))
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || strings.HasPrefix(clean, "/") {
		return ""
	}
	parts := strings.Split(clean, "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return strings.Join(parts, "/")
}
