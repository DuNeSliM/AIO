package handlers

import (
	"log"
	"net/http"
	"regexp"
)

var sensitiveQueryPattern = regexp.MustCompile(`(?i)(key|access_token|refresh_token|client_secret)=([^&\s]+)`)

func sanitizeErrorMessage(msg string) string {
	return sensitiveQueryPattern.ReplaceAllString(msg, `$1=[REDACTED]`)
}

func logSafeError(prefix string, err error) {
	if err == nil {
		return
	}
	log.Printf("%s: %s", prefix, sanitizeErrorMessage(err.Error()))
}

func writeBadGateway(w http.ResponseWriter) {
	http.Error(w, "upstream service unavailable", http.StatusBadGateway)
}

func writeInternalError(w http.ResponseWriter) {
	http.Error(w, "internal server error", http.StatusInternalServerError)
}

