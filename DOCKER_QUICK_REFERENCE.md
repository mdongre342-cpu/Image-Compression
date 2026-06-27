# Docker Quick Reference

## 🚀 Getting Started (30 seconds)

```bash
# One-command setup and start
make setup

# View running app
# → Open http://localhost:3000 in browser

# View logs
make logs

# Stop
make stop
```

---

## 📋 Common Commands

### Using Make (Recommended)
```bash
make help           # Show all available commands
make setup          # Build & start (one command)
make build          # Build image
make start          # Start development
make start-prod     # Start production
make stop           # Stop containers
make stop-prod      # Stop production
make logs           # View logs
make logs-prod      # View prod logs
make restart        # Restart containers
make rebuild        # Rebuild & restart
make health         # Check health
make clean          # Remove everything
make shell          # Open container shell
make stats          # View resource usage
```

### Using Docker Compose
```bash
docker-compose up -d              # Start dev
docker-compose down               # Stop dev
docker-compose logs -f            # View logs
docker-compose ps                 # Show containers
docker-compose exec app /bin/sh  # Open shell

# Production
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml down
```

### Using Docker CLI
```bash
# Build
docker build -t compress-compare:latest .

# Run
docker run -d \
  --name compress-compare-app \
  -p 3000:3000 \
  -v compress-data:/app/data \
  compress-compare:latest

# Logs
docker logs -f compress-compare-app

# Stop
docker stop compress-compare-app
docker rm compress-compare-app
```

---

## 🔧 Configuration

### Create .env File
```bash
cp .env.example .env
# Edit with your values
```

### Environment Variables
```env
NODE_ENV=production
JWT_SECRET=your-secret-key
PORT=3000
DATA_DIR=/app/data
```

---

## 💾 Database Operations

```bash
make db-backup      # Backup database
make db-restore     # Restore from latest backup
make db-reset       # Reset database (delete data)
```

### Manual Backup
```bash
mkdir -p backups
docker-compose exec app cp /app/data/app.db ./backups/app.db.$(date +%s)
```

---

## 🩺 Health & Monitoring

```bash
make health         # Check API health
make stats          # View resource usage
make ps             # Show running containers
make validate       # Validate configuration
make version        # Show versions
```

### Manual Health Check
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-06-17T10:30:00Z"}
```

---

## 🧹 Cleanup

```bash
make stop           # Stop containers
make clean          # Stop & remove containers, volumes, images
make clean-all      # Clean + remove all data (data/, logs/)
```

---

## 🔍 Troubleshooting

### Container won't start
```bash
# Check logs
make logs

# Check configuration
make validate

# Rebuild
make rebuild
```

### Port already in use
```bash
# Edit docker-compose.yml
# Change:  ports: ["3000:3000"]
# To:      ports: ["3001:3000"]

make restart
```

### Database issues
```bash
# Reset database
make db-reset

# Or remove volume
docker-compose down -v
make start
```

### High memory usage
```bash
# Check usage
make stats

# Limit resources in docker-compose.yml
```

---

## 📊 Image Size

```bash
# Check image size
make image-size

# Inspect image
make image-inspect
```

Expected: ~150-200MB (60% reduction from single-stage)

---

## 🌐 Accessing the App

| Environment | URL | Notes |
|-------------|-----|-------|
| Development | http://localhost:3000 | Local only |
| Production | https://yourdomain.com | With Nginx + SSL |

---

## 📝 File Roles

| File | Purpose |
|------|---------|
| `Dockerfile` | Build image |
| `docker-compose.yml` | Development environment |
| `docker-compose.prod.yml` | Production environment |
| `.dockerignore` | Exclude files from image |
| `.env.example` | Configuration template |
| `nginx.conf` | Reverse proxy config |
| `Makefile` | Command shortcuts |
| `docker-setup.sh` | Bash script (alternative to Make) |

---

## 🔐 Security Commands

```bash
# Scan image for vulnerabilities
docker scan compress-compare:latest

# Check container running as non-root
docker-compose exec app whoami
# Should output: nodejs

# View security options
docker inspect compress-compare-app | grep -i security
```

---

## 🚢 Production Checklist

```bash
# 1. Create .env with production values
cp .env.example .env
nano .env  # Change secrets

# 2. Build image
make build

# 3. Start production
make start-prod

# 4. Check health
make health

# 5. Verify logs
make logs-prod

# 6. Test API
curl https://yourdomain.com/api/health

# 7. Backup database
make db-backup
```

---

## 📚 Full Documentation

For detailed information, see:
- **DOCKER_GUIDE.md** - Complete guide with examples
- **DOCKER_FILES_CREATED.md** - Overview of all files
- **Dockerfile** - Image configuration
- **docker-compose.yml** - Development setup
- **docker-compose.prod.yml** - Production setup
- **nginx.conf** - Reverse proxy config

---

## 💡 Pro Tips

1. **Quick restart after code changes:**
   ```bash
   make rebuild
   ```

2. **Keep containers running in background:**
   ```bash
   make start  # Already runs with -d (detached)
   ```

3. **View real-time logs:**
   ```bash
   make logs   # Follow mode (-f) by default
   ```

4. **Database backup before changes:**
   ```bash
   make db-backup
   ```

5. **Test in production config locally:**
   ```bash
   make start-prod  # Uses prod compose file
   ```

---

## ⚡ One-Liners

```bash
# Full setup
make setup && sleep 2 && curl http://localhost:3000/api/health

# Start, check health, show stats
make start && sleep 2 && make health && make stats

# Backup and restart
make db-backup && make restart

# Clean rebuild
make clean && make rebuild
```

---

## 🎯 Next Commands

```bash
# Start now
make setup

# Then open browser
# http://localhost:3000

# Sign up or login to test the app

# View logs to verify everything works
make logs
```
