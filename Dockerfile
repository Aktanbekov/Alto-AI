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

# Build frontend for production
RUN npm run build

# Stage 2: Build Go Backend
FROM golang:1.23-alpine AS backend-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies (allow Go to auto-download toolchain if needed)
ENV GOTOOLCHAIN=auto
RUN go mod download

# Copy source code
COPY . .

# Build the Go application with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
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

