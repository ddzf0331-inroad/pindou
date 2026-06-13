const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixel-toy-api-"));
process.env.PIXEL_TOY_DATA_DIR = dataDir;

const { createServerConfig, handleApi } = require("../server.js");

async function main() {
  try {
    let state = await request("GET", "/api/state");
    assert.strictEqual(state.mode, "local-server", "state endpoint should report local server mode");

    await request("PUT", "/api/palette", {
      body: { palette: [{ id: "c1", code: "01", name: "红", rgb: [255, 0, 0], status: "active" }] }
    });
    await request("PUT", "/api/palette-limit", { body: { paletteLimit: 7 } });
    await request("PUT", "/api/projects", { body: { projects: [{ id: "p1", name: "测试" }] } });
    await request("PUT", "/api/settings", {
      body: {
        activeConfigId: "m1",
        configs: [
          {
            id: "m1",
            name: "本地测试",
            provider: "local",
            model: "local",
            endpoint: "",
            prompt: "test",
            enabled: false,
            apiKey: "secret"
          }
        ]
      }
    });

    state = await request("GET", "/api/state");
    assert.strictEqual(state.palette.length, 1, "palette should persist");
    assert.strictEqual(state.paletteLimit, 7, "palette limit should persist");
    assert.strictEqual(state.projects.length, 1, "projects should persist");
    assert.strictEqual(state.settings.configs[0].apiKey, undefined, "api key should be masked");
    assert.strictEqual(state.settings.configs[0].apiKeyPresent, true, "masked settings should report key presence");

    const ai = await request("POST", "/api/test-ai", { body: {} });
    assert.strictEqual(ai.ok, true, "local AI config should pass test");

    const patternMissingImage = await rawRequest("POST", "/api/parse-pattern-sheet", {
      body: { palette: [{ id: "c1", code: "A1", name: "白", rgb: [255, 255, 255], status: "active" }] }
    });
    assert.strictEqual(patternMissingImage.statusCode, 400, "pattern sheet parser should reject missing image");

    const diagnostics = await request("GET", "/api/diagnostics");
    assert.strictEqual(diagnostics.mode, "node-local-server", "diagnostics should report node mode");
    assert.strictEqual(diagnostics.dataFiles.palette, true, "diagnostics should see palette file");
    assert.strictEqual(diagnostics.activeAiConfig.apiKeyPresent, true, "diagnostics should mask key presence");

    const backup = await request("GET", "/api/backup");
    assert.strictEqual(backup.type, "pixel-toy-full-backup", "backup should have full backup type");
    assert.strictEqual(backup.palette.length, 1, "backup should include palette");
    assert.strictEqual(backup.projects.length, 1, "backup should include projects");
    assert.strictEqual(backup.settings.configs[0].apiKey, undefined, "backup should mask api key");

    await request("POST", "/api/restore", {
      body: {
        type: "pixel-toy-full-backup",
        palette: [{ id: "c2", code: "02", name: "蓝", rgb: [0, 0, 255], status: "active" }],
        projects: [{ id: "p2", name: "恢复测试" }],
        paletteLimit: 5,
        settings: {
          activeConfigId: "m2",
          configs: [{ id: "m2", name: "恢复配置", provider: "local", model: "local", prompt: "restore", enabled: false }]
        }
      }
    });
    state = await request("GET", "/api/state");
    assert.strictEqual(state.palette[0].id, "c2", "restore should replace palette");
    assert.strictEqual(state.projects[0].id, "p2", "restore should replace projects");
    assert.strictEqual(state.paletteLimit, 5, "restore should replace palette limit");
    assert.strictEqual(state.settings.activeConfigId, "m2", "restore should replace settings");

    const privateDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixel-toy-private-api-"));
    const privateConfig = createServerConfig({
      dataDir: privateDataDir,
      authPassword: "let-me-in",
      publicMode: true,
      sessionSecret: "check-secret"
    });

    const authStatus = await request("GET", "/api/auth/status", { config: privateConfig });
    assert.strictEqual(authStatus.required, true, "private web mode should require auth");
    assert.strictEqual(authStatus.authenticated, false, "private web mode should start unauthenticated");

    const blocked = await rawRequest("GET", "/api/state", { config: privateConfig });
    assert.strictEqual(blocked.statusCode, 401, "private state endpoint should reject unauthenticated requests");

    const badLogin = await rawRequest("POST", "/api/auth/login", { config: privateConfig, body: { password: "wrong" } });
    assert.strictEqual(badLogin.statusCode, 401, "wrong password should be rejected");

    const goodLogin = await rawRequest("POST", "/api/auth/login", { config: privateConfig, body: { password: "let-me-in" } });
    assert.strictEqual(goodLogin.statusCode, 200, "right password should be accepted");
    assert.ok(goodLogin.headers["Set-Cookie"], "login should set auth cookie");

    const privateState = await request("GET", "/api/state", {
      config: privateConfig,
      headers: { cookie: goodLogin.headers["Set-Cookie"].split(";")[0] }
    });
    assert.strictEqual(privateState.mode, "private-web-server", "private state should report private web mode");
    assert.strictEqual(privateState.publicMode, true, "private state should report public mode");

    const openDir = await rawRequest("POST", "/api/open-data-dir", {
      config: privateConfig,
      headers: { cookie: goodLogin.headers["Set-Cookie"].split(";")[0] },
      body: {}
    });
    assert.strictEqual(openDir.statusCode, 403, "private web mode should not open server data dir");
    fs.rmSync(privateDataDir, { recursive: true, force: true });

    console.log("Server API check passed.");
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function request(method, pathname, options = {}) {
  const res = await rawRequest(method, pathname, options);
  const payload = JSON.parse(res.body || "{}");
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`HTTP ${res.statusCode}: ${res.body}`);
  }
  return payload;
}

async function rawRequest(method, pathname, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : "";
  const req = new MockRequest(method, pathname, body, options.headers || {});
  const res = new MockResponse();
  await handleApi(req, res, new URL(pathname, "http://localhost"), options.config);
  return res;
}

class MockRequest {
  constructor(method, url, body, headers = {}) {
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.body = body;
  }

  on(event, callback) {
    if (event === "data" && this.body) {
      queueMicrotask(() => callback(this.body));
    }
    if (event === "end") {
      queueMicrotask(callback);
    }
    return this;
  }

  destroy() {}
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = "";
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  end(body = "") {
    this.body = body;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
