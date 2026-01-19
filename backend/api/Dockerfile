# ---------- build stage ----------
FROM golang:1.25-alpine AS build

WORKDIR /src

# Install git (needed if you have private deps or some modules)
RUN apk add --no-cache ca-certificates git

# Cache deps
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build a static-ish binary (CGO off) - works with modernc sqlite driver
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api


# ---------- runtime stage ----------
FROM alpine:latest

# CA certs for HTTPS (Steam calls)
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Copy binary
COPY --from=build /out/api /app/api

# SQLite database location (mount as volume in docker-compose)
ENV PORT=8080
ENV DB_PATH=/data/data.sqlite
ENV PRICE_TTL_HOURS=12
ENV DAILY_UPDATE_HOURS=24

# Data dir for sqlite
RUN mkdir -p /data && chown -R app:app /data

USER app

EXPOSE 8080

# Simple healthcheck (optional). Requires wget in image; alpine has busybox wget.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

VOLUME ["/data"]

ENTRYPOINT ["/app/api"]
