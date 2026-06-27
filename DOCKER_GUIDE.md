# Docker Setup & Deployment Guide

## Quick Start with Docker

### Prerequisites
- Docker 20.10+
- Docker Compose 1.29+

### Build & Run

#### Option 1: Using Docker Compose (Recommended)
```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Remove all data volumes
docker-compose down -v
```

#### Option 2: Using Docker CLI

**Build the image:**
```bash
docker build -t compress-compare:latest .
```

**Run the container:**
```bash
docker run -d \
  --name compress-compare-app \
  -p 3000:3000 \
  -e JWT_SECRET="your-secret-key" \
  -v compress-data:/app/data \
  compress-compare:latest
```

**View logs:**
```bash
docker logs -f compress-compare-app
```

**Stop the container:**
```bash
docker stop compress-compare-app
docker rm compress-compare-app
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-key-change-this
DATA_DIR=/app/data
CORS_ORIGIN=https://yourdomain.com
```

### Using .env with Docker Compose

Docker Compose automatically loads variables from `.env` file:

```bash
# Create .env from example
cp .env.example .env

# Edit .env with your values
nano .env

# Start with environment variables
docker-compose up -d
```

---

## Volumes & Persistent Storage

The application uses volumes for persistent data:

```yaml
volumes:
  app-data:          # SQLite database and uploads/downloads
  app-logs:          # Application logs
```

### Backup Database

```bash
# Copy database from container to host
docker cp compress-compare-app:/app/data/app.db ./backups/app.db

# Or with volumes
cp ./data/app.db ./backups/app.db
```

### Restore Database

```bash
# Copy database from host to container
docker cp ./backups/app.db compress-compare-app:/app/data/app.db
```

---

## Production Deployment

### Using Docker Compose for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    image: compress-compare:latest
    container_name: compress-compare-prod
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    volumes:
      - app-data:/app/data
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - compress-network

volumes:
  app-data:
    driver: local

networks:
  compress-network:
    driver: bridge
```

Deploy with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### With Nginx Reverse Proxy

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    client_max_body_size 50M;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Add to `docker-compose.yml`:

```yaml
nginx:
  image: nginx:alpine
  container_name: compress-compare-nginx
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./ssl:/etc/nginx/ssl:ro
  depends_on:
    - app
  networks:
    - compress-network
```

---

## Health Checks

### Check Container Health
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Manual Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-06-17T10:30:45.123Z"
}
```

---

## Troubleshooting

### Container Won't Start
```bash
# View detailed logs
docker logs compress-compare-app

# Inspect container
docker inspect compress-compare-app

# Remove and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Issues
```bash
# Reset database
docker-compose down -v

# Recreate volumes
docker-compose up -d
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Change port in docker-compose.yml
# ports:
#   - "3001:3000"
```

### High Memory Usage
```bash
# View resource usage
docker stats compress-compare-app

# Limit resources in docker-compose.yml
# deploy:
#   resources:
#     limits:
#       cpus: '0.5'
#       memory: 512M
```

---

## Image Optimization

### Current Image Size
The multi-stage build reduces image size by ~60% compared to single-stage builds:
- Builder stage: ~1.2GB (with build tools)
- Final image: ~150-200MB (runtime only)

### Further Optimization

Use Alpine Linux variant with distroless considerations:
```dockerfile
FROM node:18-alpine
# Alpine is 50-70MB vs 900MB+ for node:18-slim
```

---

## Security Best Practices

✅ **Implemented:**
- Non-root user (nodejs) running app
- Read-only root filesystem option
- Health checks
- No privileged mode
- Multi-stage build reduces attack surface

✅ **Recommended for production:**
- Use secrets management (Docker Secrets, Vault)
- Scan images with `docker scan compress-compare:latest`
- Enable Docker Content Trust
- Use private Docker registry
- Regular security updates

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/docker-build.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t compress-compare:latest .
      
      - name: Run tests in container
        run: docker run compress-compare:latest npm test
      
      - name: Push to registry
        if: startsWith(github.ref, 'refs/tags/')
        run: |
          docker tag compress-compare:latest myregistry.azurecr.io/compress-compare:${{ github.ref_name }}
          docker push myregistry.azurecr.io/compress-compare:${{ github.ref_name }}
```

---

## Deployment to Cloud Platforms

### AWS ECS
```bash
# Build and tag
docker build -t 123456789.dkr.ecr.us-east-1.amazonaws.com/compress-compare:latest .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/compress-compare:latest
```

### Google Cloud Run
```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/compress-compare

# Deploy
gcloud run deploy compress-compare --image gcr.io/PROJECT_ID/compress-compare --platform managed --region us-central1 --allow-unauthenticated
```

### Azure Container Instances
```bash
# Build and push
az acr build --registry myregistry --image compress-compare:latest .

# Deploy
az container create --resource-group mygroup --name compress-compare --image myregistry.azurecr.io/compress-compare:latest --ports 3000 --environment-variables PORT=3000
```

### Docker Hub
```bash
# Build and tag
docker build -t yourusername/compress-compare:latest .

# Push
docker push yourusername/compress-compare:latest
```

---

## Monitoring & Logging

### View Logs
```bash
# Real-time logs
docker-compose logs -f app

# Last 100 lines
docker logs --tail 100 compress-compare-app

# Timestamps
docker logs -t compress-compare-app
```

### Collect Logs to File
```bash
docker logs compress-compare-app > app.log 2>&1
```

### With ELK Stack (Elasticsearch, Logstash, Kibana)
Add to `docker-compose.yml` for centralized logging setup.

---

## Performance Tips

1. **Use .dockerignore** - Already configured to exclude ~500MB of files
2. **Multi-stage builds** - Reduces final image size by 60%
3. **Alpine Linux** - Smaller base image (5MB vs 900MB+)
4. **Layer caching** - Dockerfile ordered for optimal cache hits
5. **Volume mounts** - Keep persistent data out of image layers

---

## Support & Resources

- Docker Documentation: https://docs.docker.com
- Node.js Docker Best Practices: https://github.com/nodejs/docker-node/blob/main/README.md
- Security: https://docs.docker.com/engine/security

For issues or questions, check logs and verify configuration.
