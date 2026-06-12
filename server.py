#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("PIXEL_TOY_DATA_DIR", ROOT / "data"))
PORT = int(os.environ.get("PORT", "4173"))

FILES = {
    "palette": DATA_DIR / "palette.json",
    "projects": DATA_DIR / "projects.json",
    "settings": DATA_DIR / "settings.json",
    "paletteLimit": DATA_DIR / "palette-limit.json",
}

MIME = {
    ".html": "text/html;charset=utf-8",
    ".css": "text/css;charset=utf-8",
    ".js": "application/javascript;charset=utf-8",
    ".json": "application/json;charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/"):
            self.handle_api()
            return
        self.serve_static()

    def do_PUT(self):
        self.handle_api()

    def do_POST(self):
        self.handle_api()

    def log_message(self, format, *args):
        return

    def handle_api(self):
        if self.command == "GET" and self.path == "/api/state":
            send_json(
                self,
                200,
                {
                    "mode": "python-local-server",
                    "palette": read_json(FILES["palette"], None),
                    "projects": read_json(FILES["projects"], None),
                    "paletteLimit": read_json(FILES["paletteLimit"], None),
                    "settings": mask_settings(read_json(FILES["settings"], None)),
                },
            )
            return

        if self.command == "GET" and self.path == "/api/diagnostics":
            settings = read_json(FILES["settings"], {})
            masked = mask_settings(settings)
            active = None
            if masked:
                for config in masked["configs"]:
                    if config["id"] == masked["activeConfigId"]:
                        active = config
                        break
            send_json(
                self,
                200,
                {
                    "mode": "python-local-server",
                    "version": "0.1.0",
                    "runtime": "Python 3",
                    "dataDir": str(DATA_DIR),
                    "dataFiles": {
                        "palette": FILES["palette"].exists(),
                        "projects": FILES["projects"].exists(),
                        "settings": FILES["settings"].exists(),
                        "paletteLimit": FILES["paletteLimit"].exists(),
                    },
                    "activeAiConfig": active,
                },
            )
            return

        if self.command == "GET" and self.path == "/api/backup":
            send_json(self, 200, build_backup_payload("python-local-server"))
            return

        if self.command == "POST" and self.path == "/api/open-data-dir":
            open_data_dir()
            send_json(self, 200, {"ok": True, "dataDir": str(DATA_DIR)})
            return

        if self.command == "POST" and self.path == "/api/restore":
            backup = normalize_backup_payload(self.read_body())
            write_json(FILES["palette"], backup["palette"])
            write_json(FILES["projects"], backup["projects"])
            write_json(FILES["paletteLimit"], backup["paletteLimit"])
            write_json(FILES["settings"], merge_settings(read_json(FILES["settings"], {}), backup["settings"]))
            send_json(self, 200, {"ok": True})
            return

        if self.command == "PUT" and self.path == "/api/palette":
            body = self.read_body()
            write_json(FILES["palette"], body.get("palette", []))
            send_json(self, 200, {"ok": True})
            return

        if self.command == "PUT" and self.path == "/api/projects":
            body = self.read_body()
            write_json(FILES["projects"], body.get("projects", []))
            send_json(self, 200, {"ok": True})
            return

        if self.command == "PUT" and self.path == "/api/palette-limit":
            body = self.read_body()
            limit = min(999, max(1, int(body.get("paletteLimit") or 1)))
            write_json(FILES["paletteLimit"], limit)
            send_json(self, 200, {"ok": True, "paletteLimit": limit})
            return

        if self.command == "PUT" and self.path == "/api/settings":
            incoming = self.read_body()
            existing = read_json(FILES["settings"], {})
            merged = merge_settings(existing, incoming)
            write_json(FILES["settings"], merged)
            send_json(self, 200, {"ok": True, "settings": mask_settings(merged)})
            return

        if self.command == "POST" and self.path == "/api/test-ai":
            active = get_active_config(read_json(FILES["settings"], {}))
            ok = active.get("provider") == "local" or bool(active.get("apiKey"))
            send_json(
                self,
                200 if ok else 400,
                {
                    "ok": ok,
                    "message": f"AI 设置格式可用：{active.get('name') or active.get('model')}"
                    if ok
                    else "请先保存 API Key，或切换为本地模拟。",
                },
            )
            return

        if self.command == "POST" and self.path == "/api/cartoonize":
            send_json(
                self,
                200,
                {"imageDataUrl": None, "message": "Python 后备服务不调用云端模型，已回退到本地预处理。"},
            )
            return

        send_json(self, 404, {"error": "Not found"})

    def read_body(self):
        size = int(self.headers.get("content-length") or 0)
        if size <= 0:
            return {}
        raw = self.rfile.read(size).decode("utf-8")
        return json.loads(raw or "{}")

    def serve_static(self):
        request_path = "/index.html" if self.path == "/" else unquote(self.path.split("?", 1)[0])
        file_path = (ROOT / request_path.lstrip("/")).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"Forbidden")
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return
        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(file_path.suffix, "application/octet-stream"))
        self.end_headers()
        self.wfile.write(content)


def ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_json(file_path, fallback):
    try:
        return json.loads(Path(file_path).read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(file_path, value):
    ensure_data_dir()
    Path(file_path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_settings(settings):
    settings = settings or {}
    if settings.get("configs"):
        return {
            "activeConfigId": settings.get("activeConfigId") or settings["configs"][0].get("id"),
            "configs": [normalize_config(config) for config in settings["configs"]],
        }
    config = normalize_config(
        {
            "id": "legacy-config",
            "provider": settings.get("provider", "local"),
            "model": settings.get("model", "local-cartoon-preprocess"),
            "endpoint": settings.get("endpoint", ""),
            "prompt": settings.get("prompt", ""),
            "enabled": bool(settings.get("enabled")),
            "apiKey": settings.get("apiKey", ""),
            "apiKeyPresent": bool(settings.get("apiKeyPresent") or settings.get("apiKey")),
        }
    )
    return {"activeConfigId": config["id"], "configs": [config]}


def normalize_config(config):
    provider = config.get("provider") or "local"
    model = config.get("model") or "local-cartoon-preprocess"
    return {
        "id": config.get("id") or "model",
        "name": config.get("name") or f"{provider} · {model}",
        "provider": provider,
        "model": model,
        "endpoint": config.get("endpoint", ""),
        "prompt": config.get("prompt", ""),
        "enabled": bool(config.get("enabled")),
        "apiKey": config.get("apiKey", ""),
        "apiKeyPresent": bool(config.get("apiKeyPresent") or config.get("apiKey")),
    }


def merge_settings(existing, incoming):
    existing_normalized = normalize_settings(existing)
    incoming_normalized = normalize_settings(incoming)
    existing_by_id = {config["id"]: config for config in existing_normalized["configs"]}
    configs = []
    for config in incoming_normalized["configs"]:
        previous = existing_by_id.get(config["id"], {})
        config["apiKey"] = config.get("apiKey") or previous.get("apiKey", "")
        configs.append(config)
    return {"activeConfigId": incoming_normalized["activeConfigId"], "configs": configs}


def mask_settings(settings):
    if not settings:
        return None
    normalized = normalize_settings(settings)
    configs = []
    for config in normalized["configs"]:
        safe = dict(config)
        api_key = safe.pop("apiKey", "")
        safe["apiKeyPresent"] = bool(safe.get("apiKeyPresent") or api_key)
        configs.append(safe)
    return {"activeConfigId": normalized["activeConfigId"], "configs": configs}


def get_active_config(settings):
    normalized = normalize_settings(settings)
    for config in normalized["configs"]:
        if config["id"] == normalized["activeConfigId"]:
            return config
    return normalized["configs"][0]


def send_json(handler, status, payload):
    content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json;charset=utf-8")
    handler.end_headers()
    handler.wfile.write(content)


def build_backup_payload(mode):
    return {
        "type": "pixel-toy-full-backup",
        "version": 1,
        "mode": mode,
        "exportedAt": __import__("datetime").datetime.now().isoformat(),
        "palette": read_json(FILES["palette"], []),
        "projects": read_json(FILES["projects"], []),
        "paletteLimit": read_json(FILES["paletteLimit"], None),
        "settings": mask_settings(read_json(FILES["settings"], None)),
    }


def normalize_backup_payload(payload):
    if not payload or payload.get("type") != "pixel-toy-full-backup":
        raise ValueError("Invalid full backup")
    try:
        palette_limit = int(payload.get("paletteLimit") or 1)
    except Exception:
        palette_limit = 1
    return {
        "palette": payload.get("palette") if isinstance(payload.get("palette"), list) else [],
        "projects": payload.get("projects") if isinstance(payload.get("projects"), list) else [],
        "paletteLimit": min(999, max(1, palette_limit)),
        "settings": normalize_settings(payload.get("settings") or {}),
    }


def open_data_dir():
    ensure_data_dir()
    if sys.platform == "darwin":
        command = ["open", str(DATA_DIR)]
    elif sys.platform.startswith("win"):
        command = ["explorer", str(DATA_DIR)]
    else:
        command = ["xdg-open", str(DATA_DIR)]
    try:
        subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def run():
    ensure_data_dir()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"拼豆设计工具 Python 后备服务已启动: http://127.0.0.1:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    run()
