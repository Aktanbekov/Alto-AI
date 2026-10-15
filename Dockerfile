# Multi-stage Dockerfile for AltoAI MVP
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./
COPY visa-llm/web/data/stats.json visa-llm/web/data/questions.json /app/visa-llm/web/data/

# Build frontend for production
RUN npm run build

# Stage 2: Build Go Backend
# Must match the go directive in go.mod (currently 1.24). On a 1.23 base the
# build depended on GOTOOLCHAIN=auto fetching 1.24.2 over the network at build
# time - which is not reproducible, and which failed outright on a cold cache.
FROM golang:1.24-alpine AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./

# The base image now satisfies go.mod on its own, so pin the toolchain rather
# than letting a build silently reach for a different one.
ENV GOTOOLCHAIN=local
# Retried: module fetches go over the network from inside the build container,
# and a TLS handshake timeout against proxy.golang.org failed three multi-arch
# builds in a row here. Three attempts, then fail honestly - a bounded retry
# absorbs a flaky network without hiding a genuinely unresolvable module.
RUN for i in 1 2 3; do       go mod download && break;       echo "go mod download failed (attempt $i), retrying...";       sleep 10;       [ "$i" = 3 ] && exit 1;     done

# Copy source code
COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Build the Go application with optimizations.
#
# GOARCH comes from buildx rather than being hardcoded: this image is built
# --platform linux/amd64,linux/arm64, and a fixed GOARCH=amd64 put an amd64
# binary inside the arm64 image, which cannot execute at all. It went unnoticed
# because the server is amd64 and nothing ever ran the arm64 variant.
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build \
  -a -installsuffix cgo \
  -ldflags='-w -s -extldflags "-static"' \
  -o main ./cmd/api

# Stage 3: Final Runtime Image
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add \
  ca-certificates \
  tzdata \
  wget \
  && update-ca-certificates

# Create non-root user for security
RUN addgroup -g 1000 appuser && \
  adduser -D -u 1000 -G appuser appuser

WORKDIR /app

# Copy the built Go binary from backend-builder
COPY --from=backend-builder /app/main .

# Copy the built frontend from frontend-builder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy interview questions file (to both locations for path resolution)
COPY --from=backend-builder /app/interview/questions.json ./interview/questions.json
COPY --from=backend-builder /app/interview/questions.json ./questions.json

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./main"]

