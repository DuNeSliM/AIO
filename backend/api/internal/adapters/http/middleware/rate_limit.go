package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type ipRateVisitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// IPRateLimiter applies a token-bucket rate limit per client IP.
type IPRateLimiter struct {
	limit rate.Limit
	burst int
	ttl   time.Duration

	mu          sync.Mutex
	visitors    map[string]*ipRateVisitor
	lastCleanup time.Time
}

func NewIPRateLimiter(limit rate.Limit, burst int, ttl time.Duration) *IPRateLimiter {
	return &IPRateLimiter{
		limit:    limit,
		burst:    burst,
		ttl:      ttl,
		visitors: make(map[string]*ipRateVisitor),
	}
}

func (l *IPRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractClientIP(r)
		if !l.allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error":   "rate_limited",
				"message": "Too many requests. Please try again later.",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (l *IPRateLimiter) allow(ip string) bool {
	now := time.Now()
	if strings.TrimSpace(ip) == "" {
		ip = "unknown"
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	if l.lastCleanup.IsZero() || now.Sub(l.lastCleanup) > l.ttl {
		for key, visitor := range l.visitors {
			if now.Sub(visitor.lastSeen) > l.ttl {
				delete(l.visitors, key)
			}
		}
		l.lastCleanup = now
	}

	visitor, ok := l.visitors[ip]
	if !ok {
		visitor = &ipRateVisitor{
			limiter: rate.NewLimiter(l.limit, l.burst),
		}
		l.visitors[ip] = visitor
	}
	visitor.lastSeen = now

	return visitor.limiter.Allow()
}

func extractClientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			if ip := strings.TrimSpace(parts[0]); ip != "" {
				return ip
			}
		}
	}

	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}

	if host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr)); err == nil && host != "" {
		return host
	}

	return strings.TrimSpace(r.RemoteAddr)
}
