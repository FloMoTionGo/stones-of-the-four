#!/usr/bin/env bash
#
# play.sh - serve Stones of the Four locally and open it in a browser.
#
set -euo pipefail

readonly VERSION="1.0.0"
readonly PROG="${0##*/}"
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT
readonly GAME_FILE="index.html"

# Defaults (overridable through the environment, then through options)
port="${PLAY_PORT:-8000}"
host="${PLAY_HOST:-127.0.0.1}"
open_browser=1
file_mode=0
quiet=0

usage() {
  cat <<EOF
Usage: ${PROG} [options]

Serve Stones of the Four on a local web server and open it in your browser.
The game is a single file (${GAME_FILE}); this script only hosts and opens it.

Options:
  -p, --port PORT    Port to listen on, 1-65535.            Default: ${PLAY_PORT:-8000}
  -H, --host HOST    Address to bind the server to.          Default: ${PLAY_HOST:-127.0.0.1}
                     Use 0.0.0.0 to play from a phone or another computer
                     on your network.
  -n, --no-open      Start the server but don't open a browser; just print the URL.
  -f, --file         Skip the server and open ${GAME_FILE} straight from disk.
                     Ignores --port and --host.
  -q, --quiet        Hide the web server's request log.
  -h, --help         Show this help and exit.
  -V, --version      Print the version and exit.

Options that take a value accept both "--port 9000" and "--port=9000".

Environment:
  PLAY_PORT          Default for --port.
  PLAY_HOST          Default for --host.
  BROWSER            Command used to open the game. Without it the script tries
                     xdg-open, open (macOS) and wslview, in that order.

Requirements:
  python3 (3.7 or newer) for the local server. Not needed with --file.

Examples:
  ${PROG}                       Serve on http://127.0.0.1:8000 and open it
  ${PROG} --port 9000 --no-open Serve on port 9000, open nothing
  ${PROG} -H 0.0.0.0 -p 8080    Serve on your network, e.g. to play on a phone
  ${PROG} --file                Open the file directly, no server

Exit status:
  0  success (the server was stopped with Ctrl+C)
  1  runtime error (missing python3, port already in use, missing game file)
  2  usage error (unknown option, missing or invalid value)
EOF
}

die()       { printf '%s: error: %s\n' "$PROG" "$1" >&2; exit "${2:-1}"; }
usage_err() { printf '%s: %s\n' "$PROG" "$1" >&2; printf "Try '%s --help' for more information.\n" "$PROG" >&2; exit 2; }
info()      { printf '%s\n' "$*"; }

# Read the value of an option that needs one: "--opt value" or "--opt=value".
need_value() {
  local opt="$1" val="${2-}"
  [[ -n "$val" && "$val" != -* ]] || usage_err "option '$opt' needs a value"
  printf '%s' "$val"
}

validate_port() {
  local p="$1"
  [[ "$p" =~ ^[0-9]+$ ]] || usage_err "invalid port '$p': use a whole number from 1 to 65535"
  (( 10#$p >= 1 && 10#$p <= 65535 )) || usage_err "invalid port '$p': use a whole number from 1 to 65535"
  if (( 10#$p < 1024 )) && (( EUID != 0 )); then
    printf '%s: warning: port %s usually needs root; pick 1024 or higher if the server fails to start\n' "$PROG" "$p" >&2
  fi
}

validate_host() {
  local h="$1"
  [[ "$h" =~ ^[A-Za-z0-9.:_-]+$ ]] || usage_err "invalid host '$h': use a hostname or an IP address such as 127.0.0.1"
}

parse_args() {
  while (( $# )); do
    case "$1" in
      -p|--port)    port="$(need_value "$1" "${2-}")"; shift 2 ;;
      --port=*)     port="${1#*=}"; [[ -n "$port" ]] || usage_err "option '--port' needs a value"; shift ;;
      -H|--host)    host="$(need_value "$1" "${2-}")"; shift 2 ;;
      --host=*)     host="${1#*=}"; [[ -n "$host" ]] || usage_err "option '--host' needs a value"; shift ;;
      -n|--no-open) open_browser=0; shift ;;
      -f|--file)    file_mode=1; shift ;;
      -q|--quiet)   quiet=1; shift ;;
      -h|--help)    usage; exit 0 ;;
      -V|--version) printf '%s %s\n' "$PROG" "$VERSION"; exit 0 ;;
      --)           shift; (( $# == 0 )) || usage_err "unexpected argument '$1'"; break ;;
      -*)           usage_err "unknown option '$1'" ;;
      *)            usage_err "unexpected argument '$1'" ;;
    esac
  done
  validate_port "$port"
  validate_host "$host"
}

find_python() {
  local py
  for py in python3 python; do
    if command -v "$py" >/dev/null 2>&1 && "$py" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)' 2>/dev/null; then
      printf '%s' "$py"; return 0
    fi
  done
  return 1
}

open_url() {
  local url="$1" opener
  if [[ -n "${BROWSER:-}" ]]; then
    # shellcheck disable=SC2086  # BROWSER may carry its own arguments
    ${BROWSER} "$url" >/dev/null 2>&1 &
    return 0
  fi
  for opener in xdg-open open wslview; do
    if command -v "$opener" >/dev/null 2>&1; then
      "$opener" "$url" >/dev/null 2>&1 &
      return 0
    fi
  done
  info "No browser opener found. Open this address yourself: $url"
}

port_in_use() {
  local probe="$1"
  [[ "$probe" == "0.0.0.0" ]] && probe="127.0.0.1"
  (exec 3<>"/dev/tcp/${probe}/${port}") 2>/dev/null
}

wait_for_server() {
  local probe="$1" i
  [[ "$probe" == "0.0.0.0" ]] && probe="127.0.0.1"
  for ((i = 0; i < 50; i++)); do
    (exec 3<>"/dev/tcp/${probe}/${port}") 2>/dev/null && return 0
    kill -0 "$server_pid" 2>/dev/null || return 1
    sleep 0.1
  done
  return 1
}

server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}

main() {
  parse_args "$@"
  [[ -f "$ROOT/$GAME_FILE" ]] || die "can't find $GAME_FILE next to this script (looked in $ROOT)"

  if (( file_mode )); then
    local url="file://$ROOT/$GAME_FILE"
    if (( open_browser )); then open_url "$url"; info "Opened $url"; else info "$url"; fi
    exit 0
  fi

  local py
  py="$(find_python)" || die "python3 (3.7 or newer) is needed to run the local server. Install it, or run '$PROG --file' to open the game without a server."
  port_in_use "$host" && die "port $port is already in use. Pick another one with --port, for example: $PROG --port $((10#$port + 1))"

  local url_host="$host"
  [[ "$host" == "0.0.0.0" ]] && url_host="127.0.0.1"
  [[ "$url_host" == *:* ]] && url_host="[$url_host]"
  local url="http://${url_host}:${port}/"

  trap cleanup EXIT
  trap 'exit 0' INT TERM
  if (( quiet )); then
    "$py" -m http.server "$port" --bind "$host" --directory "$ROOT" >/dev/null 2>&1 &
  else
    "$py" -m http.server "$port" --bind "$host" --directory "$ROOT" &
  fi
  server_pid=$!

  wait_for_server "$host" || die "the server didn't start on $host:$port. Run without --quiet to see why."

  info "Stones of the Four is running at $url"
  [[ "$host" == "0.0.0.0" ]] && info "Other devices on your network can use this computer's IP address with port $port."
  info "Press Ctrl+C to stop."
  (( open_browser )) && open_url "$url"
  wait "$server_pid"
}

main "$@"
