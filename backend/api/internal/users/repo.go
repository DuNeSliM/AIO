// internal/users/repo.go
package users

import (
	"context"
	"errors"
	"sync"
)

var (
	ErrUserNotFound  = errors.New("user not found")
	ErrEmailTaken    = errors.New("email already used")
	ErrUsernameTaken = errors.New("username already used")
)

type User struct {
	ID           int64
	Email        *string
	Username     string
	PasswordHash string
}

type PublicUser struct {
	ID       int64   `json:"id"`
	Email    *string `json:"email,omitempty"`
	Username string  `json:"username"`
}

func (u *User) ToPublic() PublicUser {
	if u == nil {
		return PublicUser{}
	}
	return PublicUser{
		ID:       u.ID,
		Email:    u.Email,
		Username: u.Username,
	}
}

type Repository interface {
	Create(ctx context.Context, u *User) (*User, error)
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id int64) (*User, error)
}

type inMemoryRepo struct {
	mu          sync.RWMutex
	nextID      int64
	usersByID   map[int64]*User
	usersByMail map[string]*User
}

// NewInMemoryRepository returns a simple in-memory user repo.
// Replace this with a DB-backed impl for production.
func NewInMemoryRepository() Repository {
	return &inMemoryRepo{
		nextID:      1,
		usersByID:   make(map[int64]*User),
		usersByMail: make(map[string]*User),
	}
}

func (r *inMemoryRepo) Create(_ context.Context, u *User) (*User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if u.Email != nil {
		if _, exists := r.usersByMail[*u.Email]; exists {
			return nil, ErrEmailTaken
		}
	}

	u.ID = r.nextID
	r.nextID++

	cp := *u
	r.usersByID[u.ID] = &cp
	if cp.Email != nil {
		r.usersByMail[*cp.Email] = &cp
	}

	return &cp, nil
}

func (r *inMemoryRepo) FindByEmail(_ context.Context, email string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	u, ok := r.usersByMail[email]
	if !ok {
		return nil, ErrUserNotFound
	}
	cp := *u
	return &cp, nil
}

func (r *inMemoryRepo) FindByID(_ context.Context, id int64) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	u, ok := r.usersByID[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	cp := *u
	return &cp, nil
}
