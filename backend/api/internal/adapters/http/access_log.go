package httpapi

import (
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// requestLogMiddleware intentionally logs path only (without query string).
func requestLogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		log.Printf("%s %s %d %dB %s", r.Method, r.URL.Path, ww.Status(), ww.BytesWritten(), time.Since(start).Round(time.Millisecond))
	})
}
