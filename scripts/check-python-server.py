#!/usr/bin/env python3
import importlib.util
import json
import os
import tempfile
from io import BytesIO
from pathlib import Path

data_dir = tempfile.mkdtemp(prefix="pixel-toy-python-api-")
os.environ["PIXEL_TOY_DATA_DIR"] = data_dir

spec = importlib.util.spec_from_file_location("pixel_server", "server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class MockHandler(server.Handler):
    def __init__(self, method, path, body=None):
        self.command = method
        self.path = path
        self.headers = {}
        raw = b""
        if body is not None:
            raw = json.dumps(body).encode("utf-8")
            self.headers["content-length"] = str(len(raw))
        self.rfile = BytesIO(raw)
        self.wfile = BytesIO()
        self.status = None
        self.response_headers = {}

    def send_response(self, status):
        self.status = status

    def send_header(self, key, value):
        self.response_headers[key.lower()] = value

    def end_headers(self):
        pass


def request(method, path, body=None):
    handler = MockHandler(method, path, body)
    server.Handler.handle_api(handler)
    payload = json.loads(handler.wfile.getvalue().decode("utf-8") or "{}")
    if handler.status < 200 or handler.status >= 300:
        raise AssertionError(f"HTTP {handler.status}: {payload}")
    return payload


state = request("GET", "/api/state")
assert state["mode"] == "python-local-server"

request("PUT", "/api/palette", {"palette": [{"id": "c1", "code": "01", "name": "红", "rgb": [255, 0, 0], "status": "active"}]})
request("PUT", "/api/palette-limit", {"paletteLimit": 9})
request("PUT", "/api/projects", {"projects": [{"id": "p1", "name": "测试"}]})
request(
    "PUT",
    "/api/settings",
    {
        "activeConfigId": "m1",
        "configs": [
            {
                "id": "m1",
                "name": "本地测试",
                "provider": "local",
                "model": "local",
                "endpoint": "",
                "prompt": "test",
                "enabled": False,
                "apiKey": "secret",
            }
        ],
    },
)

state = request("GET", "/api/state")
assert len(state["palette"]) == 1
assert state["paletteLimit"] == 9
assert len(state["projects"]) == 1
assert "apiKey" not in state["settings"]["configs"][0]
assert state["settings"]["configs"][0]["apiKeyPresent"] is True

ai = request("POST", "/api/test-ai", {})
assert ai["ok"] is True

diagnostics = request("GET", "/api/diagnostics")
assert diagnostics["mode"] == "python-local-server"
assert diagnostics["dataFiles"]["palette"] is True
assert diagnostics["activeAiConfig"]["apiKeyPresent"] is True

backup = request("GET", "/api/backup")
assert backup["type"] == "pixel-toy-full-backup"
assert len(backup["palette"]) == 1
assert len(backup["projects"]) == 1
assert "apiKey" not in backup["settings"]["configs"][0]

request(
    "POST",
    "/api/restore",
    {
        "type": "pixel-toy-full-backup",
        "palette": [{"id": "c2", "code": "02", "name": "蓝", "rgb": [0, 0, 255], "status": "active"}],
        "projects": [{"id": "p2", "name": "恢复测试"}],
        "paletteLimit": 5,
        "settings": {
            "activeConfigId": "m2",
            "configs": [{"id": "m2", "name": "恢复配置", "provider": "local", "model": "local", "prompt": "restore", "enabled": False}],
        },
    },
)
state = request("GET", "/api/state")
assert state["palette"][0]["id"] == "c2"
assert state["projects"][0]["id"] == "p2"
assert state["paletteLimit"] == 5
assert state["settings"]["activeConfigId"] == "m2"

for item in Path(data_dir).glob("*"):
    item.unlink()
Path(data_dir).rmdir()

print("Python server API check passed.")
