# Toko Online Frontend - F1 Setup & Foundation

**Status:** F1 (Setup dan Fondasi) - Struktur dan konfigurasi lengkap ✅

## Yang Sudah Dibuat (F1 Complete)

### 1. Konfigurasi Project
- `package.json` - Semua dependencies: React 18, Vite, TypeScript strict, Tailwind, React Router, TanStack Query, React Hook Form, Zod, Recharts
- `vite.config.ts` - Setup Vite dengan alias `@/`
- `tsconfig.json` - TypeScript strict mode penuh
- `tailwind.config.js` - Tema warna primary custom + utilities
- `postcss.config.js` - PostCSS dengan Tailwind & Autoprefixer
- `.env` & `.env.example` - Environment variables

### 2. Core Infrastructure ⭐
- **API Client** (`src/lib/api/client.ts`)
  - Axios wrapper dengan interceptor
  - Logic 401 Unauthorized: refresh 1x, antrian request
  - Auto-set access token di header
  - Error normalization dari backend format
  
- **Auth Provider** (`src/contexts/AuthContext.tsx`)
  - State: user, access token (memory), isLoading
  - Methods: login, register, logout, recoverSession
  - Session recovery otomatis saat app dibuka (refresh + /me)
  - useAuth() hook untuk akses di komponen

- **Router** (`src/app/router.tsx`)
  - Lazy loading per halaman
  - Guards: RequireAuth (redirect ke /login), RequireAdmin (403)
  - Fallback Spinner saat loading
  - Dev-only /_ui untuk UI showcase

- **Utilities** (`src/lib/utils.ts`)
  - `formatRupiah()` - Format currency IDR
  - `formatDate()` - Format tanggal bahasa Indonesia
  - `useDebounce()` - Hook debounce
  - `cn()` - Class name merger
  - `preventOpenRedirect()` - Cegah open redirect di login

- **TanStack Query** (`src/lib/query.ts`)
  - QueryClient setup dengan stale time 5 menit

### 3. Type Safety
- `src/lib/api/types.ts` - Semua tipe API response/request
  - Auth, Product, Cart, Address, Shipping, Order, Payment, Tracking

### 4. Styling
- `src/index.css` - Tailwind setup dengan custom utilities
- Design tokens di `tailwind.config.js` - Skala warna 50-900

### 5. Entry Points
- `index.html` - HTML template
- `src/main.tsx` - React entry with providers
- `src/App.tsx` - Root dengan RouterProvider

### 6. Placeholder Pages (semua F2-F8)
- 23 page stubs siap diimplementasi tahap berikutnya

## Struktur Folder

```
frontend/
├── src/
│   ├── app/
│   │   └── router.tsx          # Router + guards
│   ├── components/
│   │   └── ui/
│   │       └── Spinner.tsx     # Loading state
│   ├── contexts/
│   │   └── AuthContext.tsx     # Auth state & recovery
│   ├── features/               # Feature-based structure
│   │   ├── auth/pages/         # F6: Login, Register, Password reset
│   │   ├── catalog/pages/      # F2-F3: Home, Products, Detail
│   │   ├── cart/pages/         # F4: Cart
│   │   ├── checkout/pages/     # F4: Checkout
│   │   ├── orders/pages/       # F5: Orders, Payment, Tracking
│   │   ├── account/pages/      # F6: Profile, Addresses
│   │   └── admin/pages/        # F7: Dashboard, Orders, Payments, Products, etc.
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts       # Axios + 401 logic
│   │   │   └── types.ts        # API types
│   │   ├── query.ts            # TanStack Query setup
│   │   └── utils.ts            # Helpers
│   ├── pages/
│   │   ├── NotFoundPage.tsx    # 404
│   │   └── UIShowcase.tsx      # Dev-only component showcase
│   ├── index.css               # Tailwind + custom CSS
│   ├── main.tsx                # React entry
│   └── App.tsx                 # Root router
├── index.html                  # HTML template
├── package.json                # Dependencies
├── vite.config.ts              # Vite config
├── tsconfig.json               # TS strict config
├── tailwind.config.js          # Tailwind theme
├── postcss.config.js           # PostCSS
└── .env                        # Local env
```

## Kriteria F1 Selesai ✅

- ✅ Aplikasi berjalan (semua file siap, tinggal `npm install` & `npm run dev`)
- ✅ Login & logout bekerja ke backend (Auth provider + API client siap)
- ✅ Sesi pulih setelah refresh halaman (recoverSession di useEffect)
- ✅ Token kedaluwarsa auto-refresh (interceptor 401 dengan antrian)

## Langkah Selanjutnya

### Di Lokal (Sekarang)
```bash
cd frontend
npm install
npm run dev
```

Akan buka di `http://localhost:5173` dengan API ke `http://localhost:8080/api/v1`

### F2: Design System & Layout (Selanjutnya)
- Komponen UI: Button, Input, Card, Modal, Badge, Skeleton, etc.
- Navbar + Footer
- Halaman Home dengan hero, kategori, produk terbaru
- Halaman /_ui untuk showcase semua komponen

### F3: Katalog & Detail Produk
### F4: Keranjang & Checkout  
### F5: Pembayaran & Tracking
### F6: Autentikasi & Akun
### F7: Panel Admin
### F8: Testing & Deployment

## Catatan Teknis

### 401 Refresh Logic
```
Request failed 401?
  ├─ Jika ada refreshPromise aktif: tunggu + retry
  └─ Jika tidak ada:
     ├─ POST /auth/refresh (buat promise)
     ├─ Set access token baru
     ├─ Retry request original
     └─ Jika refresh gagal: logout + redirect /login
```

### Session Recovery
Saat app dibuka:
1. `await apiClient.post('/auth/refresh')` - pakai refresh token dari cookie
2. `await apiClient.get('/me')` - ambil data user
3. Set user di AuthContext
4. Jika gagal: user = null, redirect ke /login kalau akses halaman protected

### Type Safety
- Semua API request/response punya type di `types.ts`
- TypeScript strict mode penuh (noImplicitAny, strictNullChecks, dll)
- Form validation dengan Zod

## Environment

Backend API: `http://localhost:8080/api/v1` (dari VITE_API_URL)

Pastikan backend jalan sebelum frontend dev server:
```bash
cd ../backend
go run ./cmd/api
```

---

**Dibuat:** F1 Setup & Fondasi complete  
**Next:** F2 Design System & Layout
