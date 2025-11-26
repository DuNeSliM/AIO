// internal/users/postgres_repo.go
package users

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/lib/pq"
)

type postgresRepo struct {
	db *sql.DB
}

// NewPostgresRepository creates a PostgreSQL-backed user repository
func NewPostgresRepository(db *sql.DB) Repository {
	return &postgresRepo{db: db}
}

func (r *postgresRepo) Create(ctx context.Context, u *User) (*User, error) {
	query := `
		INSERT INTO users (email, username, password_hash, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, email, username, password_hash, created_at, updated_at
	`

	now := time.Now()
	var created User
	var email sql.NullString

	err := r.db.QueryRowContext(
		ctx,
		query,
		u.Email,
		u.Username,
		u.PasswordHash,
		now,
		now,
	).Scan(
		&created.ID,
		&email,
		&created.Username,
		&created.PasswordHash,
		new(time.Time),
		new(time.Time),
	)

	if err != nil {
		// Check for unique constraint violations
		if pqErr, ok := err.(*pq.Error); ok {
			if pqErr.Code == "23505" { // unique_violation
				if pqErr.Constraint == "users_email_key" {
					return nil, ErrEmailTaken
				}
				if pqErr.Constraint == "users_username_key" {
					return nil, ErrUsernameTaken
				}
			}
		}
		return nil, err
	}

	if email.Valid {
		created.Email = &email.String
	}

	return &created, nil
}

func (r *postgresRepo) FindByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, email, username, password_hash
		FROM users
		WHERE email = $1
	`

	var u User
	var emailVal sql.NullString

	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID,
		&emailVal,
		&u.Username,
		&u.PasswordHash,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	if emailVal.Valid {
		u.Email = &emailVal.String
	}

	return &u, nil
}

func (r *postgresRepo) FindByID(ctx context.Context, id int64) (*User, error) {
	query := `
		SELECT id, email, username, password_hash
		FROM users
		WHERE id = $1
	`

	var u User
	var email sql.NullString

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID,
		&email,
		&u.Username,
		&u.PasswordHash,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	if email.Valid {
		u.Email = &email.String
	}

	return &u, nil
}
