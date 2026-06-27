# Compress & Compare — Makefile
# Convenient commands for Docker operations

.PHONY: help build start start-prod stop stop-prod logs logs-prod health clean rebuild restart

# Variables
IMAGE_NAME := compress-compare
IMAGE_TAG := latest
CONTAINER_NAME := compress-compare-app
PORT := 3000

# Default target
.DEFAULT_GOAL := help

# Help target
help:
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║ Compress & Compare — Docker Management                        ║"
	@echo "╠═══════════════════════════════════════════════════════════════╣"
	@echo "║ Development Commands:                                         ║"
	@echo "║   make build        - Build Docker image                      ║"
	@echo "║   make start        - Start development environment           ║"
	@echo "║   make stop         - Stop development containers             ║"
	@echo "║   make logs         - View application logs                   ║"
	@echo "║   make restart      - Restart containers                      ║"
	@echo "║   make rebuild      - Rebuild image and restart               ║"
	@echo "║   make health       - Check container health                  ║"
	@echo "║                                                               ║"
	@echo "║ Production Commands:                                          ║"
	@echo "║   make start-prod   - Start production environment            ║"
	@echo "║   make stop-prod    - Stop production containers              ║"
	@echo "║   make logs-prod    - View production logs                    ║"
	@echo "║                                                               ║"
	@echo "║ Maintenance:                                                  ║"
	@echo "║   make clean        - Remove containers and images            ║"
	@echo "║   make ps           - Show running containers                 ║"
	@echo "║   make shell        - Open shell in running container         ║"
	@echo "║   make env-setup    - Create .env from .env.example           ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"

# Build Docker image
build:
	@echo "Building Docker image: $(IMAGE_NAME):$(IMAGE_TAG)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	@echo "✓ Image built successfully"

# Start development environment
start: .env
	@echo "Starting development environment..."
	docker-compose up -d
	@echo "✓ Development environment started"
	@echo "Access the app at http://localhost:$(PORT)"

# Start production environment
start-prod: .env
	@echo "Starting production environment..."
	docker-compose -f docker-compose.prod.yml up -d
	@echo "✓ Production environment started"

# Stop development containers
stop:
	@echo "Stopping development containers..."
	docker-compose down
	@echo "✓ Containers stopped"

# Stop production containers
stop-prod:
	@echo "Stopping production containers..."
	docker-compose -f docker-compose.prod.yml down
	@echo "✓ Production containers stopped"

# View development logs
logs:
	docker-compose logs -f app

# View production logs
logs-prod:
	docker-compose -f docker-compose.prod.yml logs -f app

# Health check
health:
	@echo "Checking container health..."
	@if docker ps | grep -q $(CONTAINER_NAME); then \
		echo "✓ Container is running"; \
		curl -s http://localhost:$(PORT)/api/health | jq . || echo "✗ API is not responding"; \
	else \
		echo "✗ Container is not running"; \
	fi

# Show running containers
ps:
	@docker-compose ps

ps-prod:
	@docker-compose -f docker-compose.prod.yml ps

# Restart containers
restart: stop start

# Rebuild image and restart
rebuild: clean build start

# Open shell in container
shell:
	docker-compose exec app /bin/sh

shell-prod:
	docker-compose -f docker-compose.prod.yml exec app /bin/sh

# Create .env file
env-setup:
	@if [ ! -f ".env" ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "✓ .env created - please update with your values"; \
	else \
		echo "✓ .env already exists"; \
	fi

# Clean up
clean:
	@echo "Removing containers, volumes, and images..."
	docker-compose down -v || true
	docker-compose -f docker-compose.prod.yml down -v || true
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) || true
	@echo "✓ Cleanup completed"

# Clean everything (including volumes)
clean-all: clean
	@echo "Removing all data..."
	rm -rf data/ logs/
	@echo "✓ All data removed"

# Build and start from scratch
setup: env-setup build start
	@echo "✓ Setup completed - app is running at http://localhost:$(PORT)"

# CI/CD commands
test:
	docker-compose run --rm app npm test

lint:
	docker-compose run --rm app npm run lint

# Database operations
db-backup:
	@mkdir -p backups
	@echo "Backing up database..."
	docker cp $$(docker-compose ps -q app):/app/data/app.db backups/app.db.$$(date +%Y%m%d_%H%M%S)
	@echo "✓ Database backed up"

db-restore:
	@echo "Restoring database from latest backup..."
	@if [ -f "$$(ls -t backups/app.db.* 2>/dev/null | head -1)" ]; then \
		docker cp "$$(ls -t backups/app.db.* | head -1)" $$(docker-compose ps -q app):/app/data/app.db; \
		echo "✓ Database restored"; \
	else \
		echo "✗ No backup found"; \
	fi

db-reset:
	@echo "Resetting database..."
	docker-compose exec app rm -f /app/data/app.db
	docker-compose restart app
	@echo "✓ Database reset"

# Image operations
image-size:
	@echo "Image size:"
	@docker images | grep $(IMAGE_NAME) || echo "Image not found"

image-inspect:
	@docker inspect $(IMAGE_NAME):$(IMAGE_TAG) | jq '.[0] | {Id, Created, Architecture, Os}'

# Network operations
network-inspect:
	@docker network inspect $$(docker-compose ps -q app | cut -c 1-12) || echo "Network not found"

# Monitoring
stats:
	docker stats $$(docker-compose ps -q app)

# Development utilities
validate:
	@echo "Validating Docker configuration..."
	docker-compose config > /dev/null && echo "✓ docker-compose.yml is valid" || echo "✗ docker-compose.yml has errors"
	docker-compose -f docker-compose.prod.yml config > /dev/null && echo "✓ docker-compose.prod.yml is valid" || echo "✗ docker-compose.prod.yml has errors"

version:
	@echo "Docker versions:"
	@docker --version
	@docker-compose --version
	@echo ""
	@echo "Node version in image:"
	@docker run --rm $(IMAGE_NAME):$(IMAGE_TAG) node --version

.env:
	@make env-setup

.PHONY: .env
