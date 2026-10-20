package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrEmailTaken = errors.New("email already registered")
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	Phone        string    `json:"phone"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	PasswordHash string    `json:"-"`
}

type RefreshToken struct {
	ID        string
	UserID    string
	ExpiresAt time.Time
	RevokedAt *time.Time
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

const userColumns = `id::text, email, name, COALESCE(phone, ''), role, password_hash, created_at, updated_at`

func scanUser(row pgx.Row) (*User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Phone, &u.Role, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) CreateUser(ctx context.Context, name, email, phone, passwordHash string) (*User, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO users (name, email, phone, password_hash)
		 VALUES ($1, $2, $3, $4)
		 RETURNING `+userColumns,
		name, email, phone, passwordHash,
	)
	u, err := scanUser(row)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return u, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE email = $1`, email))
}

func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1::uuid`, id))
}

func (s *Store) InsertRefreshToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1::uuid, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	return err
}

func (s *Store) GetRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	var t RefreshToken
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, user_id::text, expires_at, revoked_at
		 FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&t.ID, &t.UserID, &t.ExpiresAt, &t.RevokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Store) RevokeRefreshToken(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW()
		 WHERE id = $1::uuid AND revoked_at IS NULL`, id)
	return err
}

func (s *Store) RevokeRefreshTokenByHash(ctx context.Context, tokenHash string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW()
		 WHERE token_hash = $1 AND revoked_at IS NULL`, tokenHash)
	return err
}

func (s *Store) UpdateUserProfile(ctx context.Context, id, name, phone string) (*User, error) {
	return scanUser(s.pool.QueryRow(ctx,
		`UPDATE users SET name = $2, phone = $3, updated_at = NOW()
		 WHERE id = $1::uuid
		 RETURNING `+userColumns,
		id, name, phone))
}

func (s *Store) UpdatePasswordHash(ctx context.Context, id, passwordHash string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1::uuid`,
		id, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RevokeAllRefreshTokens mencabut semua sesi (refresh token) milik user,
// dipakai setelah kata sandi diganti.
func (s *Store) RevokeAllRefreshTokens(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW()
		 WHERE user_id = $1::uuid AND revoked_at IS NULL`, userID)
	return err
}