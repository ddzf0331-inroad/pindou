#!/bin/sh
set -u

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${TMPDIR:-/tmp}/pixel-toy-designer.log"
URL="http://127.0.0.1:4173"

find_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  for candidate in \
    /usr/local/bin/node \
    /opt/homebrew/bin/node \
    /usr/bin/node; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi

  for candidate in \
    /usr/bin/python3 \
    /usr/local/bin/python3 \
    /opt/homebrew/bin/python3; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

open_url() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 &
    return 0
  fi
  if command -v open >/dev/null 2>&1; then
    open "$1" >/dev/null 2>&1 &
    return 0
  fi
  return 1
}

is_service_ready() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$URL" >/dev/null 2>&1
    return $?
  fi
  return 1
}

cd "$APP_ROOT"

if is_service_ready; then
  open_url "$URL" || printf '%s\n' "$URL"
  exit 0
fi

NODE_BIN="$(find_node || true)"
PYTHON_BIN="$(find_python || true)"

if [ -n "$NODE_BIN" ]; then
  "$NODE_BIN" server.js >"$LOG_FILE" 2>&1 &
elif [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" server.py >"$LOG_FILE" 2>&1 &
else
  open_url "$APP_ROOT/index.html" || printf 'Open %s/index.html\n' "$APP_ROOT"
  exit 1
fi

sleep 1

if is_service_ready; then
  open_url "$URL" || printf '%s\n' "$URL"
else
  open_url "$APP_ROOT/index.html" || printf 'Open %s/index.html\nLog: %s\n' "$APP_ROOT" "$LOG_FILE"
fi
