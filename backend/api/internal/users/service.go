// internal/users/service.go
package users

import (
	"context"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	RegisterWithPassword(ctx context.Context, email, username, password string) (*User, error)
	AuthenticateWithEmail(ctx context.Context, email, password string) (*User, error)
	GetByID(ctx context.Context, id int64) (*User, error)
}

type service struct {
	repo Repository
}

func NewService(r Repository) Service {
	return &service{repo: r}
}

func (s *service) RegisterWithPassword(
	ctx context.Context,
	email, username, password string,
) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	u := &User{
		Email:        &email,
		Username:     username,
		PasswordHash: string(hash),
	}

	created, err := s.repo.Create(ctx, u)
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (s *service) AuthenticateWithEmail(
	ctx context.Context,
	email, password string,
) (*User, error) {
	u, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	return u, nil
}

func (s *service) GetByID(ctx context.Context, id int64) (*User, error) {
	return s.repo.FindByID(ctx, id)
}
