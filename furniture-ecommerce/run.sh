#!/usr/bin/env bash
# =============================================================================
# run.sh — Furniture E-commerce project runner
#
# Usage: ./run.sh <env> <command> [options]
#
# Environments:
#   dev       Uses docker/docker-compose.dev.yml + .env       (hot-reload)
#   staging   Uses docker/docker-compose.yml    + .env.staging (production build)
#
# Commands:
#   up                    Build and start all services
#   down                  Stop and remove containers
#   build                 Rebuild images without starting
#   restart [service]     Restart a specific service (or all)
#   logs [service]        Tail logs (default: all services)
#   exec <service>        Open an interactive shell in a container
#   clean                 Stop all services and remove volumes (wipes DB)
#
# Examples:
#   ./run.sh dev up
#   ./run.sh dev logs api
#   ./run.sh dev exec api
#   ./run.sh dev restart postgres
#   ./run.sh staging up
#   ./run.sh staging down
# =============================================================================

set -euo pipefail

# ── colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── determine the absolute path of the directory ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# ── helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}${BOLD}[run]${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}[run]${RESET} $*"; }
warn()    { echo -e "${YELLOW}${BOLD}[run]${RESET} $*"; }
error()   { echo -e "${RED}${BOLD}[run]${RESET} $*" >&2; }

usage() {
  local exit_code="${1:-0}"
  echo -e "
${BOLD}Usage:${RESET}
  ./run.sh <env> <command> [options]

${BOLD}Environments:${RESET}
  ${CYAN}dev${RESET}       Hot-reload dev   (docker/docker-compose.dev.yml + .env)
  ${CYAN}staging${RESET}   Production build (docker/docker-compose.yml    + .env.staging)

${BOLD}Commands:${RESET}
  ${GREEN}up${RESET}                      Build and start all services
  ${GREEN}down${RESET}                    Stop and remove containers
  ${GREEN}build${RESET}                   Rebuild images without starting
  ${GREEN}restart${RESET} [service]       Restart a service (omit for all)
  ${GREEN}logs${RESET}    [service]       Tail logs (omit for all services)
  ${GREEN}exec${RESET}    <service>       Open a shell inside a container
  ${GREEN}clean${RESET}                   Remove containers + volumes (wipes DB)

${BOLD}Examples:${RESET}
  ./run.sh dev up
  ./run.sh dev logs api
  ./run.sh dev exec api
  ./run.sh dev restart postgres
  ./run.sh staging up
  ./run.sh staging down
"
  exit "${exit_code}"
}

# ── resolve env ───────────────────────────────────────────────────────────────
resolve_env() {
  local env="$1"
  case "$env" in
    dev)
      COMPOSE_FILE="${SCRIPT_DIR}/docker/docker-compose.dev.yml"
      ENV_FILE="${SCRIPT_DIR}/.env"
      ;;
    staging)
      COMPOSE_FILE="${SCRIPT_DIR}/docker/docker-compose.yml"
      ENV_FILE="${SCRIPT_DIR}/.env.staging"
      ;;
    *)
      error "Unknown environment: '${env}'. Valid values: dev | staging"
      exit 1
      ;;
  esac

  if [[ ! -f "$ENV_FILE" ]]; then
    error "Env file '${ENV_FILE}' not found."
    if [[ "$env" == "dev" ]]; then
      warn "Run: cp .env.example .env  and fill in the values."
    else
      warn "Run: cp .env.example .env.staging  and fill in the staging values."
    fi
    exit 1
  fi

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    error "Compose file '${COMPOSE_FILE}' not found."
    exit 1
  fi
}

# ── docker compose wrapper ────────────────────────────────────────────────────
dc() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

# ── argument parsing ──────────────────────────────────────────────────────────
if [[ $# -lt 2 ]]; then
  usage 1
fi

ENV="$1"
CMD="$2"
shift 2
EXTRA_ARGS=("$@")

resolve_env "$ENV"

info "Environment : ${BOLD}${ENV}${RESET}"
info "Compose file: ${BOLD}${COMPOSE_FILE}${RESET}"
info "Env file    : ${BOLD}${ENV_FILE}${RESET}"
echo ""

# ── commands ──────────────────────────────────────────────────────────────────
case "$CMD" in

  up)
    info "Starting services..."
    dc up --build ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  down)
    info "Stopping services..."
    dc down ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  build)
    info "Building images..."
    dc build ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  restart)
    info "Restarting ${EXTRA_ARGS[*]:-all services}..."
    dc restart ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  logs)
    info "Tailing logs for ${EXTRA_ARGS[*]:-all services}..."
    dc logs -f ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  exec)
    if [[ ${#EXTRA_ARGS[@]} -eq 0 ]]; then
      error "Usage: ./run.sh ${ENV} exec <service>  (e.g. api | postgres)"
      exit 1
    fi
    SERVICE="${EXTRA_ARGS[0]}"
    info "Opening shell in '${SERVICE}'..."
    dc exec "$SERVICE" sh
    ;;

  clean)
    warn "This will remove all containers AND volumes (database data will be lost)."
    read -rp "Are you sure? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      info "Cleaning up..."
      dc down -v
      success "Done — all containers and volumes removed."
    else
      info "Aborted."
    fi
    ;;

  help|--help|-h)
    usage 0
    ;;

  *)
    error "Unknown command: '${CMD}'"
    usage 1
    ;;

esac
