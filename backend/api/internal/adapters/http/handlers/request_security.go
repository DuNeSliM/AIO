package handlers

import (
	"net/http"
	"strings"
)

func requestScheme(r *http.Request) string {
	if isSecureRequest(r) {
		return "https"
	}
	return "http"
}

func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}

	if hasForwardedProto(r.Header.Get("X-Forwarded-Proto")) {
		return true
	}

	if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Ssl")), "on") {
		return true
	}

	forwarded := strings.ToLower(r.Header.Get("Forwarded"))
	return strings.Contains(forwarded, "proto=https")
}

func hasForwardedProto(value string) bool {
	for _, part := range strings.Split(value, ",") {
		if strings.EqualFold(strings.TrimSpace(part), "https") {
			return true
		}
	}
	return false
}
