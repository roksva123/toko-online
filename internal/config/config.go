package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// App
	Env          string
	HTTPPort     string
	HTTPAddr     string
	PublicAPIURL string

	// Database
	DatabaseURL      string
	DatabaseMaxConns int
	DatabaseMinConns int

	// JWT
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration

	// CORS
	CORSOrigins []string

	// S3/Storage
	S3Endpoint       string
	S3Bucket         string
	S3AccessKey      string
	S3SecretKey      string
	S3UseSSL         bool
	S3PublicEndpoint string

	// Shipping
	ShippingProvider string
	BiteshipAPIKey   string
	OriginLatitude   float64
	OriginLongitude  float64

	// Email
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	// Admin seed
	AdminEmail    string
	AdminPassword string

	// Payment
	PaymentExpiryHours int
	LowStockThreshold  int

	// Job scheduler
	JobPaymentExpiryInterval string
	JobShippingPollInterval  string

	// Logging
	LogLevel string
}

func Load() *Config {
	// Load .env file if it exists (for development)
	_ = godotenv.Load()

	cfg := &Config{
		Env:                      getEnv("APP_ENV", "development"),
		HTTPPort:                 getEnv("HTTP_PORT", "8080"),
		HTTPAddr:                 getEnv("HTTP_ADDR", "0.0.0.0"),
		PublicAPIURL:             getEnv("PUBLIC_API_URL", "http://localhost:8080"),
		DatabaseURL:              getEnv("DATABASE_URL", ""),
		DatabaseMaxConns:         getEnvInt("DATABASE_MAX_CONNS", 25),
		DatabaseMinConns:         getEnvInt("DATABASE_MIN_CONNS", 5),
		JWTSecret:                getEnv("JWT_SECRET", ""),
		AccessTokenTTL:           getEnvDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:          getEnvDuration("REFRESH_TOKEN_TTL", 7*24*time.Hour),
		CORSOrigins:              getEnvList("CORS_ORIGINS", []string{
				"http://localhost:3000", "http://localhost:5173", "http://localhost:5174",
				"http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174",
			}),
		S3Endpoint:               getEnv("S3_ENDPOINT", "http://localhost:9000"),
		S3Bucket:                 getEnv("S3_BUCKET", "toko-online"),
		S3AccessKey:              getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey:              getEnv("S3_SECRET_KEY", "minioadmin"),
		S3UseSSL:                 getEnvBool("S3_USE_SSL", false),
		S3PublicEndpoint:         getEnv("S3_PUBLIC_ENDPOINT", "http://localhost:9000"),
		ShippingProvider:         getEnv("SHIPPING_PROVIDER", "mock"),
		BiteshipAPIKey:           getEnv("BITESHIP_API_KEY", ""),
		OriginLatitude:           getEnvFloat("ORIGIN_LATITUDE", -6.2088),
		OriginLongitude:          getEnvFloat("ORIGIN_LONGITUDE", 106.8456),
		SMTPHost:                 getEnv("SMTP_HOST", "localhost"),
		SMTPPort:                 getEnvInt("SMTP_PORT", 1025),
		SMTPUser:                 getEnv("SMTP_USER", ""),
		SMTPPass:                 getEnv("SMTP_PASS", ""),
		SMTPFrom:                 getEnv("SMTP_FROM", "noreply@toko-online.local"),
		AdminEmail:               getEnv("ADMIN_EMAIL", "admin@toko-online.local"),
		AdminPassword:            getEnv("ADMIN_PASSWORD", "Admin@123456"),
		PaymentExpiryHours:       getEnvInt("PAYMENT_EXPIRY_HOURS", 24),
		LowStockThreshold:        getEnvInt("LOW_STOCK_THRESHOLD", 10),
		JobPaymentExpiryInterval: getEnv("JOB_PAYMENT_EXPIRY_INTERVAL", "1m"),
		JobShippingPollInterval:  getEnv("JOB_SHIPPING_POLL_INTERVAL", "6h"),
		LogLevel:                 getEnv("LOG_LEVEL", "info"),
	}

	// Validate required fields
	cfg.validate()

	return cfg
}

func (c *Config) validate() {
	required := map[string]string{
		"DATABASE_URL": c.DatabaseURL,
		"JWT_SECRET":   c.JWTSecret,
	}

	for key, val := range required {
		if val == "" {
			log.Fatalf("required environment variable %s is not set", key)
		}
	}
}

func getEnv(key string, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	if val := os.Getenv(key); val != "" {
		return val == "true" || val == "1" || val == "yes"
	}
	return defaultVal
}

func getEnvFloat(key string, defaultVal float64) float64 {
	if val := os.Getenv(key); val != "" {
		if floatVal, err := strconv.ParseFloat(val, 64); err == nil {
			return floatVal
		}
	}
	return defaultVal
}

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if val := os.Getenv(key); val != "" {
		if dur, err := time.ParseDuration(val); err == nil {
			return dur
		}
	}
	return defaultVal
}

func getEnvList(key string, defaultVal []string) []string {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	var list []string
	for _, item := range strings.Split(val, ",") {
		if item = strings.TrimSpace(item); item != "" {
			list = append(list, item)
		}
	}
	if len(list) == 0 {
		return defaultVal
	}
	return list
}
