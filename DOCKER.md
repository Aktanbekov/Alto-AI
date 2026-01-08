# Docker Setup for AltoAI MVP

This project includes Docker support for easy deployment and development.

## Prerequisites

- Docker (version 20.10 or later)
- Docker Compose (optional, for easier management)

## Building the Docker Image

### Build the image:
```bash
docker build -t altoai-mvp:latest .
```

### Build with a specific tag:
```bash
docker build -t altoai-mvp:v1.0.0 .
```

## Running the Container

### Using Docker directly:
```bash
docker run -d \
  --name altoai-mvp \
  -p 8080:8080 \
  --env-file .env \
  altoai-mvp:latest
```

### Using Docker Compose:
```bash
docker-compose up -d
```

### View logs:
```bash
docker logs -f altoai-mvp
```

### Stop the container:
```bash
docker stop altoai-mvp
```

### Remove the container:
```bash
docker rm altoai-mvp
```

## Environment Variables

Create a `.env` file in the root directory with your configuration:

```env
# Database (PostgreSQL - required)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=altoai
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=altoai_db

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URL=http://localhost:8080/auth/google/callback

# JWT Configuration
JWT_SECRET=your-very-secure-random-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRY=30m
REFRESH_TOKEN_EXPIRY=720h

# Application Configuration
APP_PORT=8080
GIN_MODE=release
FRONTEND_URL=http://localhost:8080
```

## Production Deployment

### 1. Build for production:
```bash
docker build -t altoai-mvp:production .
```

### 2. Run with production settings:
```bash
docker run -d \
  --name altoai-mvp \
  -p 8080:8080 \
  --restart unless-stopped \
  --env-file .env.production \
  altoai-mvp:production
```

## Health Check

The container includes a health check endpoint at `/health`. You can verify it's running:

```bash
curl http://localhost:8080/health
```

## Architecture

The Dockerfile uses a multi-stage build:

1. **Frontend Builder**: Builds the React frontend using Node.js
2. **Backend Builder**: Builds the Go backend application
3. **Runtime Image**: Minimal Alpine Linux image with only the compiled binaries and static files

**Note**: The application requires a PostgreSQL database. Use `docker-compose.yml` to run both the application and database together, or connect to an external PostgreSQL instance.

## Troubleshooting

### Container won't start:
- Check logs: `docker logs altoai-mvp`
- Verify environment variables are set correctly
- Ensure port 8080 is not already in use

### Frontend not loading:
- Verify the frontend was built correctly in the build stage
- Check that static files are being served from `/frontend/dist`

### API calls failing:
- Ensure the backend is accessible
- Check CORS settings if calling from a different origin
- Verify environment variables are set correctly

## Development vs Production

- **Development**: Run `npm run dev` in frontend and `go run cmd/api/main.go` separately
- **Production**: Use Docker to build and serve both frontend and backend together
