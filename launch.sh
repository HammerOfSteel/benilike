#!/usr/bin/env bash
# launch.sh — benilike dev launcher
#
# Usage:
#   ./launch.sh                 start server + client (if not already running), open browser
#   ./launch.sh --stop          stop server + client
#   ./launch.sh --restart       restart server (client stays running)
#   ./launch.sh --spectate      start server + client if needed, then open spectate session with 6 bots
#   ./launch.sh --server-only   start/ensure only the server
#   ./launch.sh --client-only   start/ensure only the client

set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PID="/tmp/benilike-server.pid"
CLIENT_PID="/tmp/benilike-client.pid"
SERVER_LOG="/tmp/benilike-server.log"
CLIENT_LOG="/tmp/benilike-client.log"
SERVER_PORT=2567
CLIENT_PORT=3000
CLIENT_URL="http://localhost:${CLIENT_PORT}"

# ── Parse flags ───────────────────────────────────────────────────────────────
MODE="start"
for arg in "$@"; do
  case "$arg" in
    --stop)        MODE="stop"        ;;
    --restart)     MODE="restart"     ;;
    --spectate)    MODE="spectate"    ;;
    --server-only) MODE="server-only" ;;
    --client-only) MODE="client-only" ;;
    *) echo "Unknown flag: $arg" && exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
BOLD='\033[1m'; RESET='\033[0m'
CYAN='\033[36m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; GRAY='\033[90m'

log()  { echo -e "  ${CYAN}·${RESET} $*"; }
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; }
err()  { echo -e "  ${RED}✗${RESET} ${BOLD}$*${RESET}"; }
info() { echo -e "${YELLOW}▸${RESET} $*"; }

port_in_use() { lsof -ti:"$1" &>/dev/null; }

wait_for_port() {
  local port=$1 name=$2 max=${3:-20}
  for ((i=0; i<max; i++)); do
    sleep 0.5
    if port_in_use "$port"; then
      ok "$name ready on :${port}"
      return 0
    fi
    printf "."
  done
  echo ""
  err "$name did not start on :${port} — check log: /tmp/benilike-${name,,}.log"
  return 1
}

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null) || true
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.3
    # SIGKILL if still alive
    pids=$(lsof -ti:"$port" 2>/dev/null) || true
    [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
  fi
}

kill_pidfile() {
  local pid_file=$1
  if [[ -f "$pid_file" ]]; then
    local pid
    pid=$(cat "$pid_file")
    kill "$pid" 2>/dev/null || true
    rm -f "$pid_file"
  fi
}

# ── Server ────────────────────────────────────────────────────────────────────
start_server() {
  if port_in_use $SERVER_PORT; then
    ok "Server already running on :${SERVER_PORT}"
    return 0
  fi
  info "Starting Colyseus server (port ${SERVER_PORT})…"
  cd "$SCRIPT_DIR"
  npm run dev:server >"$SERVER_LOG" 2>&1 &
  echo $! >"$SERVER_PID"
  wait_for_port $SERVER_PORT "server" 30
}

stop_server() {
  info "Stopping server…"
  kill_pidfile "$SERVER_PID"
  kill_port $SERVER_PORT
  ok "Server stopped"
}

# ── Client ────────────────────────────────────────────────────────────────────
start_client() {
  if port_in_use $CLIENT_PORT; then
    ok "Client already running on :${CLIENT_PORT}"
    return 0
  fi
  info "Starting Vite client (port ${CLIENT_PORT})…"
  cd "$SCRIPT_DIR"
  npm run dev:client >"$CLIENT_LOG" 2>&1 &
  echo $! >"$CLIENT_PID"
  wait_for_port $CLIENT_PORT "client" 40
}

stop_client() {
  info "Stopping client…"
  kill_pidfile "$CLIENT_PID"
  kill_port $CLIENT_PORT
  ok "Client stopped"
}

open_browser() {
  log "Opening ${CLIENT_URL} …"
  open "$CLIENT_URL" 2>/dev/null || xdg-open "$CLIENT_URL" 2>/dev/null || true
}

# ── Modes ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════╗${RESET}"
echo -e "${BOLD}║      benilike launcher       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════╝${RESET}"
echo ""

case "$MODE" in

  start)
    start_server
    start_client
    echo ""
    ok "Both services up — opening browser"
    open_browser
    echo ""
    log "Logs: ${GRAY}${SERVER_LOG}${RESET}  ${GRAY}${CLIENT_LOG}${RESET}"
    echo ""
    ;;

  stop)
    stop_server
    stop_client
    echo ""
    ok "All services stopped"
    echo ""
    ;;

  restart)
    stop_server
    echo ""
    start_server
    echo ""
    ok "Server restarted"
    log "Client still at ${CLIENT_URL}"
    echo ""
    ;;

  spectate)
    start_server
    start_client
    echo ""
    info "Launching spectate session (6 bots, medium map)…"
    echo ""
    cd "$SCRIPT_DIR"
    npm run show -- --spectate --bots 6 --size medium --duration 300
    ;;

  server-only)
    start_server
    echo ""
    ;;

  client-only)
    start_client
    echo ""
    ok "Client up — opening browser"
    open_browser
    echo ""
    ;;

esac
