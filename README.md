# Toko Online Backend

Backend untuk toko online single-vendor dengan pembayaran transfer manual dan tracking paket.

## Tech Stack

- **Go** 1.22+ dengan chi router
- **PostgreSQL** 16 untuk database
- **MinIO** untuk storage (S3-compatible)
- **JWT** untuk autentikasi
- **Docker & Docker Compose** untuk development

## Prerequisites

- Go 1.22 atau lebih baru
- PostgreSQL 16
- Docker & Docker Compose
- Make

## Setup Development

### 1. Clone Repository

```bash
git clone <repo-url>
cd toko-online
```

### 2. Konfigurasi Environment

Copy `.env.example` ke `.env` dan sesuaikan konfigurasi:

```bash
cp .env.example .env
```

Edit `.env` dan ubah nilai-nilai sesuai kebutuhan Anda. Wajib ubah:
- `JWT_SECRET` - harus minimal 32 karakter untuk production
- `DATABASE_URL` - sesuaikan dengan database lokal Anda (atau gunakan docker-compose)

### 3. Jalankan Services dengan Docker Compose

```bash
make docker-up
```

Ini akan menjalankan:
- PostgreSQL 16 di port 5432
- MinIO di port 9000 (console di 9001)
- MailHog di port 8025 (web UI untuk testing email)

Akses:
- MinIO Console: http://localhost:9001 (user: minioadmin, pass: minioadmin)
- MailHog: http://localhost:8025

### 4. Install Dependencies dan Jalankan Migrasi

```bash
# Download Go dependencies
go mod download

# Jalankan migrasi database
make migrate-up
```

### 5. Seed Database

```bash
make seed
```

Ini akan membuat:
- Admin user: admin@toko-online.local / Admin@123456
- Beberapa kategori default
- Bank accounts untuk pembayaran

### 6. Jalankan Server

```bash
# Development dengan auto-reload (requires air)
make dev

# atau langsung jalankan
make run
```

Server akan berjalan di `http://localhost:8080`

## API Endpoints

### Health Check
```bash
GET /api/v1/health
```

Response:
```json
{
  "data": {
    "status": "ok",
    "time": "2024-01-15T10:30:00Z"
  }
}
```

Endpoint lainnya akan ditambahkan di tahap berikutnya (B2, B3, dst).

## Database

### Struktur

Semua tabel didefinisikan di `migrations/000001_init.up.sql`:

- **users** - User dan admin
- **refresh_tokens** - JWT refresh tokens
- **password_resets** - Password reset tokens
- **addresses** - Alamat pengiriman
- **categories** - Kategori produk (bisa nested)
- **products** - Produk
- **product_variants** - Varian produk (sku, harga, stok, berat)
- **product_images** - Gambar produk
- **stock_movements** - Audit trail perubahan stok
- **carts & cart_items** - Keranjang belanja
- **orders & order_items** - Pesanan dan item dalam pesanan
- **order_status_history** - Riwayat perubahan status pesanan
- **payments** - Pembayaran transfer manual
- **bank_accounts** - Rekening bank toko
- **shipment_events** - Event tracking pengiriman

### Migrasi

```bash
# Jalankan migrasi up
make migrate-up

# Rollback
make migrate-down

# Buat migrasi baru
make migrate-create NAME=add_column_to_users
```

## Development Commands

```bash
# Jalankan server dengan auto-reload
make dev

# Jalankan server sekali
make run

# Jalankan tests
make test

# Jalankan linter
make lint

# Format code
make fmt

# Generate SQL queries dengan sqlc
make sqlc

# Seed database
make seed

# Docker compose
make docker-up      # Jalankan services
make docker-down    # Stop services
make docker-logs    # Lihat logs
```

## Testing

```bash
make test
```

Setiap endpoint penting harus memiliki test. Target coverage: 70% untuk layanan inti.

## Project Structure

```
.
├── cmd/
│   ├── api/
│   │   └── main.go              # Entry point server
│   ├── migrate/
│   │   └── main.go              # Database migration runner
│   └── seed/
│       └── main.go              # Database seeder
├── internal/
│   ├── config/
│   │   └── config.go            # Configuration loading
│   ├── platform/
│   │   ├── db/
│   │   │   └── db.go            # Database connection setup
│   │   ├── logger/
│   │   │   └── logger.go        # Structured logging
│   │   ├── storage/
│   │   │   └── storage.go       # Storage interface
│   │   └── mailer/
│   │       └── mailer.go        # Email interface
│   ├── httpx/
│   │   ├── response/
│   │   │   └── response.go      # HTTP response helpers
│   │   ├── error/
│   │   │   └── error.go         # HTTP error handling
│   │   └── middleware/
│   │       └── middleware.go    # HTTP middleware
│   ├── auth/                    # Authentication (B2)
│   ├── user/                    # User management (B2)
│   ├── catalog/                 # Products & categories (B3)
│   ├── cart/                    # Shopping cart (B4)
│   ├── order/                   # Orders (B5)
│   ├── payment/                 # Payment processing (B6)
│   ├── shipping/                # Shipping & tracking (B7)
│   ├── admin/                   # Admin dashboard (B8)
│   └── jobs/                    # Background jobs
├── migrations/                  # Database migrations
├── sql/                         # SQL queries (untuk sqlc)
├── docker-compose.yml
├── Makefile
├── go.mod
├── .env.example
├── openapi.yaml                 # API specification
└── README.md
```

## Environment Variables

Lihat `.env.example` untuk daftar lengkap environment variable yang tersedia.

### Production vs Development

**Development:**
- `APP_ENV=development`
- `DATABASE_URL=postgres://...` (gunakan docker-compose)
- `S3_ENDPOINT=http://localhost:9000` (MinIO lokal)
- `SHIPPING_PROVIDER=mock` (shipping palsu untuk tes)
- `SMTP_HOST=localhost` dengan MailHog

**Production:**
- `APP_ENV=production`
- `JWT_SECRET` harus strong
- `DATABASE_URL` pointing ke production database dengan SSL
- `S3_ENDPOINT` ke Cloudflare R2 atau S3 AWS
- `SHIPPING_PROVIDER=biteship` dengan API key
- SMTP dengan email provider yang sesungguhnya (SendGrid, AWS SES, dll)

## Aturan Bisnis (WAJIB)

1. **Uang:** Semua nominal uang disimpan sebagai BIGINT rupiah, BUKAN float
2. **Harga:** Saat checkout, nama produk, harga, dan SKU di-snapshot ke order_items agar pesanan lama tidak berubah
3. **Stok:** Stok dikurangi dalam 1 transaksi database dengan SELECT ... FOR UPDATE untuk mencegah race condition
4. **Pembayaran:** Nominal transfer = total + kode unik (1-999). Tidak boleh ada 2 pembayaran dengan nominal yang sama saat status pending/waiting_confirmation
5. **Status Pesanan:** pending_payment → paid → processing → shipped → delivered (atau expired/cancelled)
6. **Transisi Status:** Hanya transisi yang sah boleh terjadi, tercatat di order_status_history

## API Documentation

Lengkap di `openapi.yaml`. Buka dengan Swagger Editor atau tools lain:

```bash
# Online (upload openapi.yaml ke https://editor.swagger.io)
# Atau install swagger-ui lokal dan buka: http://localhost:8000
```

## Troubleshooting

### Database connection error
```
Pastikan PostgreSQL running dan DATABASE_URL benar
make docker-up  # Jalankan docker-compose jika belum
```

### Migration error
```
make migrate-down   # Rollback semua
make migrate-up     # Jalankan ulang
```

### Port already in use
```
Ganti port di .env atau .docker-compose.yml
```

## Tahapan Pengembangan

- **B1** ✓ Setup proyek dan database (selesai)
- **B2** Auth, user, alamat (coming next)
- **B3** Katalog dan produk
- **B4** Keranjang belanja
- **B5** Checkout dan pesanan
- **B6** Pembayaran transfer manual
- **B7** Pengiriman dan tracking
- **B8** Dashboard admin, hardening, deployment

## Support

Untuk pertanyaan atau issues, hubungi tim development.

## License

Proprietary - Toko Online
