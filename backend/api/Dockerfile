FROM golang:1.25-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go mod tidy
RUN go build -o server .

FROM alpine:latest
RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache ca-certificates \
    && update-ca-certificates || true

WORKDIR /app
COPY --from=builder /app/server /app/server

ENV PORT=8080
EXPOSE 8080
CMD ["/app/server"]
