// internal/auth/providers.go
package auth

import (
	"context"
	"fmt"

	"aoi/api/internal/users"
)

type ExternalAuthService interface {
	GetAuthURL(ctx context.Context, provider, state string) (string, error)
	HandleCallback(ctx context.Context, provider, code, state string) (*users.User, error)
}

type dummyExternalAuthService struct {
	repo users.Repository
}

// NewExternalAuthService returns a dummy implementation for now.
func NewExternalAuthService(repo users.Repository) ExternalAuthService {
	return &dummyExternalAuthService{repo: repo}
}

func (s *dummyExternalAuthService) GetAuthURL(_ context.Context, provider, state string) (string, error) {
	// In a real implementation we return the provider’s OAuth URL.
	// For now, simulate by redirecting straight to our callback:
	return fmt.Sprintf("/auth/%s/callback?code=dummy-code&state=%s", provider, state), nil
}

func (s *dummyExternalAuthService) HandleCallback(
	ctx context.Context,
	provider, code, state string,
) (*users.User, error) {
	_ = code
	_ = state

	// For now, just create or reuse a user based on provider.
	email := fmt.Sprintf("%s-user@example.com", provider)
	existing, err := s.repo.FindByEmail(ctx, email)
	if err == nil && existing != nil {
		return existing, nil
	}

	username := fmt.Sprintf("%s_user", provider)
	return s.repo.Create(ctx, &users.User{
		Email:    &email,
		Username: username,
	})
}
