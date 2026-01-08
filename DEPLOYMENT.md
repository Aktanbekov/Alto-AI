# Production Deployment Guide

This guide covers deploying AltoAI MVP to production using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- A server with at least 2GB RAM and 10GB disk space

## Quick Start

1. **Clone the repository and navigate to the project directory**

2. **Create a `.env` file** with your production configuration:
   ```bash
   cp .env.example .env
   # Edit .env with your production values
   ```

3. **Build and start the services**:
   ```bash
   docker-compose up -d --build
   ```

4. **Verify the deployment**:
   ```bash
   curl http://localhost:8080/health
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```env
# Application
APP_PORT=8080
GIN_MODE=release
FRONTEND_URL=https://yourdomain.com

# Database (PostgreSQL - required)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=altoai
POSTGRES_PASSWORD=strong_password_here
POSTGRES_DB=altoai_db

# JWT
JWT_SECRET=your-very-secure-random-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRY=30m
REFRESH_TOKEN_EXPIRY=720h

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=https://yourdomain.com/auth/google/callback

# OpenAI API
OPENAI_API_KEY=your-openai-api-key
# OR
GPT_API_KEY=your-gpt-api-key

# SMTP (for email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

### Optional Variables

```env
# Cookie Domain (for production)
COOKIE_DOMAIN=.yourdomain.com
```

## Production Configuration

### 1. Security Considerations

- **Change all default passwords** in the `.env` file
- Use a **strong JWT_SECRET** (minimum 32 characters, random)
- Set **GIN_MODE=release** for production
- Use **HTTPS** in production (configure reverse proxy like Nginx)
- Set **COOKIE_DOMAIN** for proper cookie handling across subdomains

### 2. Database

**Important**: The application now uses PostgreSQL for persistent storage. The PostgreSQL database is automatically created and managed by Docker Compose. Data is persisted in a Docker volume named `postgres_data`.

The database schema is automatically migrated on startup, including:
- Users table with email verification, password reset, and profile fields (college, major)
- Automatic column additions for new features

**Backup the database**:
```bash
docker exec altoai-postgres pg_dump -U altoai altoai_db > backup.sql
```

**Restore the database**:
```bash
docker exec -i altoai-postgres psql -U altoai altoai_db < backup.sql
```

### 3. Reverse Proxy (Nginx Example)

For production, use a reverse proxy like Nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Monitoring and Logs

**View logs**:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f altoai-mvp
docker-compose logs -f postgres
```

**Check container status**:
```bash
docker-compose ps
```

**Health checks**:
```bash
# Application health
curl http://localhost:8080/health

# Database health (from inside container)
docker exec altoai-postgres pg_isready -U altoai
```

## Deployment Steps

### Initial Deployment

1. **Prepare the server**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo apt install docker-compose-plugin -y
   ```

2. **Clone and configure**:
   ```bash
   git clone <repository-url>
   cd altoai_mvp
   cp .env.example .env
   nano .env  # Edit with production values
   ```

3. **Build and start**:
   ```bash
   docker-compose up -d --build
   ```

4. **Verify**:
   ```bash
   docker-compose ps
   curl http://localhost:8080/health
   ```

### Updating the Application

1. **Pull latest changes**:
   ```bash
   git pull
   ```

2. **Rebuild and restart**:
   ```bash
   docker-compose up -d --build
   ```

3. **Verify**:
   ```bash
   docker-compose logs -f altoai-mvp
   ```

### Rolling Back

If you need to rollback to a previous version:

```bash
# Stop current containers
docker-compose down

# Checkout previous version
git checkout <previous-commit-hash>

# Rebuild and start
docker-compose up -d --build
```

## Maintenance

### Database Maintenance

**Access PostgreSQL**:
```bash
docker exec -it altoai-postgres psql -U altoai -d altoai_db
```

**Vacuum database**:
```bash
docker exec altoai-postgres psql -U altoai -d altoai_db -c "VACUUM ANALYZE;"
```

### Clean Up

**Remove unused images**:
```bash
docker image prune -a
```

**Remove unused volumes** (⚠️ be careful):
```bash
docker volume prune
```

**View disk usage**:
```bash
docker system df
```

## Troubleshooting

### Container won't start

1. Check logs:
   ```bash
   docker-compose logs altoai-mvp
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Check database connection:
   ```bash
   docker-compose logs postgres
   ```

### Database connection errors

1. Ensure PostgreSQL is healthy:
   ```bash
   docker-compose ps postgres
   ```

2. Check database logs:
   ```bash
   docker-compose logs postgres
   ```

3. Verify environment variables match between services:
   - `POSTGRES_HOST` should be `postgres` (service name in docker-compose)
   - `POSTGRES_PORT` should be `5432`
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` must match between services

4. Check if database is ready:
   ```bash
   docker exec altoai-postgres pg_isready -U altoai
   ```

5. Verify database connection from app container:
   ```bash
   docker exec altoai-mvp env | grep POSTGRES
   ```

### Port conflicts

If port 8080 is already in use, change it in `.env`:
```env
APP_PORT=3000
```

And update `FRONTEND_URL` and `GOOGLE_REDIRECT_URL` accordingly.

### Frontend not loading

1. Verify frontend was built:
   ```bash
   docker exec altoai-mvp ls -la /app/frontend/dist
   ```

2. Check application logs for static file serving errors

## Scaling

For horizontal scaling, consider:

1. **Load balancer**: Use Nginx or Traefik as a load balancer
2. **Database**: Use managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.)
3. **Container orchestration**: Migrate to Kubernetes for better scaling

## Backup Strategy

1. **Database backups** (daily):
   ```bash
   # Add to crontab
   0 2 * * * docker exec altoai-postgres pg_dump -U altoai altoai_db | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
   ```

2. **Environment files**: Keep `.env` files in secure secret management

3. **Docker volumes**: Backup the `postgres_data` volume regularly

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review health endpoints: `curl http://localhost:8080/health`
- Verify all environment variables are set correctly



