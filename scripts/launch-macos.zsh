#!/bin/zsh
set -u

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="/tmp/pixel-toy-designer.log"
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

show_error() {
  /usr/bin/osascript -e "display dialog \"$1\" buttons {\"好\"} default button \"好\" with icon caution" >/dev/null 2>&1 || true
}

cd "$APP_ROOT"

if /usr/bin/curl -fsS "$URL" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

NODE_BIN="$(find_node || true)"
PYTHON_BIN="$(find_python || true)"

if [ -n "$NODE_BIN" ]; then
  "$NODE_BIN" server.js >"$LOG_FILE" 2>&1 &
elif [ -n "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" server.py >"$LOG_FILE" 2>&1 &
else
  show_error "没有找到 Node.js 或 Python 3，无法启动本机服务。已打开静态版。"
  open index.html
  exit 1
fi

sleep 1

if /usr/bin/curl -fsS "$URL" >/dev/null 2>&1; then
  open "$URL"
else
  show_error "本机服务未能启动，已打开静态版。日志位置：$LOG_FILE"
  open index.html
fi
