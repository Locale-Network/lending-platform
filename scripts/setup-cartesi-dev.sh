#!/bin/bash

# Cartesi Development Environment Setup Script
#
# This script sets up the local Cartesi development environment for
# testing the zkFetch + Cartesi DSCR verification flow.
#
# Prerequisites:
# - Docker installed and running
# - Cartesi CLI installed (npm install -g @cartesi/cli)
# - Node.js 18+
#
# Usage:
#   ./scripts/setup-cartesi-dev.sh [start|stop|status|logs]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CARTESI_DIR="$PROJECT_ROOT/../cartesi-dapp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi

    # Check Cartesi CLI
    if ! command -v cartesi &> /dev/null; then
        log_warn "Cartesi CLI not found. Installing..."
        npm install -g @cartesi/cli
    fi

    log_info "Prerequisites check passed."
}

start_cartesi() {
    check_prerequisites

    log_info "Starting Cartesi development environment..."

    # Check if Cartesi dapp directory exists
    if [ ! -d "$CARTESI_DIR" ]; then
        log_error "Cartesi dapp directory not found at: $CARTESI_DIR"
        log_info "Please ensure the cartesi-dapp directory exists."
        exit 1
    fi

    cd "$CARTESI_DIR"

    # Build the Cartesi machine if needed
    if [ ! -f ".cartesi/image/hash" ]; then
        log_info "Building Cartesi machine..."
        cartesi build
    fi

    # Start nonodo (local Cartesi node) in background
    log_info "Starting nonodo (local Cartesi node)..."

    # Check if nonodo is already running
    if pgrep -f "nonodo" > /dev/null; then
        log_warn "nonodo is already running."
    else
        # Start nonodo in background
        nohup nonodo > "$PROJECT_ROOT/logs/nonodo.log" 2>&1 &
        echo $! > "$PROJECT_ROOT/.nonodo.pid"
        log_info "nonodo started with PID $(cat $PROJECT_ROOT/.nonodo.pid)"
    fi

    # Wait for nonodo to be ready
    log_info "Waiting for nonodo to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log_info "nonodo is ready!"
            break
        fi
        sleep 1
    done

    log_info "Cartesi development environment is running."
    log_info ""
    log_info "Endpoints:"
    log_info "  - GraphQL: http://localhost:8080/graphql"
    log_info "  - Inspect: http://localhost:8080/inspect"
    log_info "  - InputBox: Use cartesi send or relay service"
    log_info ""
    log_info "To view logs: ./scripts/setup-cartesi-dev.sh logs"
    log_info "To stop: ./scripts/setup-cartesi-dev.sh stop"
}

stop_cartesi() {
    log_info "Stopping Cartesi development environment..."

    # Stop nonodo
    if [ -f "$PROJECT_ROOT/.nonodo.pid" ]; then
        PID=$(cat "$PROJECT_ROOT/.nonodo.pid")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            log_info "Stopped nonodo (PID $PID)"
        fi
        rm "$PROJECT_ROOT/.nonodo.pid"
    fi

    # Kill any remaining nonodo processes
    pkill -f "nonodo" 2>/dev/null || true

    log_info "Cartesi development environment stopped."
}

status_cartesi() {
    log_info "Checking Cartesi development environment status..."

    # Check nonodo
    if pgrep -f "nonodo" > /dev/null; then
        log_info "nonodo: RUNNING"

        # Check health
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log_info "  Health: OK"
        else
            log_warn "  Health: NOT RESPONDING"
        fi
    else
        log_warn "nonodo: NOT RUNNING"
    fi

    # Check Docker containers
    CARTESI_CONTAINERS=$(docker ps --filter "name=cartesi" --format "{{.Names}}" 2>/dev/null)
    if [ -n "$CARTESI_CONTAINERS" ]; then
        log_info "Docker containers:"
        echo "$CARTESI_CONTAINERS" | while read container; do
            log_info "  - $container: RUNNING"
        done
    fi
}

logs_cartesi() {
    log_info "Showing Cartesi logs..."

    if [ -f "$PROJECT_ROOT/logs/nonodo.log" ]; then
        tail -f "$PROJECT_ROOT/logs/nonodo.log"
    else
        log_error "No logs found. Is Cartesi running?"
    fi
}

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Main command handling
case "${1:-start}" in
    start)
        start_cartesi
        ;;
    stop)
        stop_cartesi
        ;;
    status)
        status_cartesi
        ;;
    logs)
        logs_cartesi
        ;;
    restart)
        stop_cartesi
        sleep 2
        start_cartesi
        ;;
    *)
        echo "Usage: $0 {start|stop|status|logs|restart}"
        exit 1
        ;;
esac
