#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Compress & Compare — Docker Setup Script
# Automates Docker image building and container management
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="compress-compare"
IMAGE_TAG="latest"
CONTAINER_NAME="compress-compare-app"
PORT="${PORT:-3000}"
NODE_ENV="${NODE_ENV:-development}"

# Functions
print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_success "Docker Compose is installed"
}

# Build Docker image
build_image() {
    print_header "Building Docker Image"
    
    if docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .; then
        print_success "Docker image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}"
        docker images | grep ${IMAGE_NAME}
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

# Start containers with Docker Compose
start_dev() {
    print_header "Starting Development Environment"
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found"
        print_info "Creating .env from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success ".env file created"
            print_warning "Please update .env with your configuration"
        else
            print_error ".env.example not found"
            exit 1
        fi
    fi
    
    if docker-compose up -d; then
        print_success "Containers started successfully"
        sleep 2
        docker-compose ps
    else
        print_error "Failed to start containers"
        exit 1
    fi
}

# Start production environment
start_prod() {
    print_header "Starting Production Environment"
    
    if [ ! -f ".env" ]; then
        print_error ".env file not found. Please create it first."
        exit 1
    fi
    
    if docker-compose -f docker-compose.prod.yml up -d; then
        print_success "Production containers started successfully"
        sleep 2
        docker-compose -f docker-compose.prod.yml ps
    else
        print_error "Failed to start production containers"
        exit 1
    fi
}

# Stop containers
stop_containers() {
    print_header "Stopping Containers"
    
    if [ "$1" == "prod" ]; then
        docker-compose -f docker-compose.prod.yml down
    else
        docker-compose down
    fi
    
    print_success "Containers stopped"
}

# View logs
view_logs() {
    print_header "Application Logs"
    
    if [ "$1" == "prod" ]; then
        docker-compose -f docker-compose.prod.yml logs -f ${CONTAINER_NAME}
    else
        docker-compose logs -f ${CONTAINER_NAME}
    fi
}

# Clean up
cleanup() {
    print_header "Cleanup"
    
    echo "This will remove containers, volumes, and images."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Removing containers..."
        docker-compose down -v || true
        docker-compose -f docker-compose.prod.yml down -v || true
        
        print_warning "Removing image..."
        docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
        
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Health check
health_check() {
    print_header "Health Check"
    
    if docker ps | grep -q ${CONTAINER_NAME}; then
        print_success "Container is running"
        
        # Check API health
        if curl -s http://localhost:${PORT}/api/health > /dev/null; then
            print_success "API is responding"
            curl -s http://localhost:${PORT}/api/health | jq .
        else
            print_error "API is not responding"
            return 1
        fi
    else
        print_error "Container is not running"
        return 1
    fi
}

# Display usage
usage() {
    echo "Compress & Compare — Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build         Build Docker image"
    echo "  start         Start development environment"
    echo "  start-prod    Start production environment"
    echo "  stop          Stop development containers"
    echo "  stop-prod     Stop production containers"
    echo "  logs          View application logs (development)"
    echo "  logs-prod     View application logs (production)"
    echo "  health        Check container and API health"
    echo "  clean         Remove containers, volumes, and images"
    echo "  help          Show this help message"
    echo ""
}

# Main script logic
main() {
    case "${1:-help}" in
        build)
            check_docker
            build_image
            ;;
        start)
            check_docker
            build_image
            start_dev
            print_info "Access the app at http://localhost:${PORT}"
            ;;
        start-prod)
            check_docker
            build_image
            start_prod
            print_info "Production app is running"
            ;;
        stop)
            stop_containers
            ;;
        stop-prod)
            stop_containers prod
            ;;
        logs)
            view_logs
            ;;
        logs-prod)
            view_logs prod
            ;;
        health)
            health_check
            ;;
        clean)
            cleanup
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            print_error "Unknown command: $1"
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
