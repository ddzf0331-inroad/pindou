const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const DEFAULT_ROOT = __dirname;
const DEFAULT_DATA_DIR = process.env.PIXEL_TOY_DATA_DIR || path.join(DEFAULT_ROOT, "data");
const DEFAULT_PORT = Number(process.env.PORT || 4173);
const DATA_FILES = ["palette.json", "projects.json", "palette-limit.json", "settings.json"];

const MIME = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function createServerConfig(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT);
  const dataDir = path.resolve(options.dataDir || DEFAULT_DATA_DIR);
  const port = Number(options.port ?? DEFAULT_PORT);
  const authPassword = String(options.authPassword ?? process.env.PIXEL_TOY_PASSWORD ?? process.env.PINDOU_PASSWORD ?? "");
  const publicMode = Boolean(
    options.publicMode ?? parseBooleanEnv(process.env.PIXEL_TOY_PUBLIC_MODE || process.env.PINDOU_PUBLIC_MODE) ?? authPassword
  );
  const sessionSecret = String(
    options.sessionSecret ||
      process.env.PIXEL_TOY_SESSION_SECRET ||
      crypto.createHash("sha256").update(`${dataDir}:${authPassword || "local"}`).digest("hex")
  );
  return {
    rootDir,
    dataDir,
    port,
    publicMode,
    mode: options.mode || (publicMode ? "node-private-web-server" : "node-local-server"),
    stateMode: options.stateMode || (publicMode ? "private-web-server" : "local-server"),
    auth: {
      enabled: Boolean(authPassword),
      passwordHash: authPassword ? hashSecret(authPassword) : "",
      sessionToken: authPassword ? hashSecret(`${sessionSecret}:${authPassword}`) : "",
      cookieName: "pixel_toy_auth"
    },
    files: {
      palette: path.join(dataDir, "palette.json"),
      projects: path.join(dataDir, "projects.json"),
      settings: path.join(dataDir, "settings.json"),
      paletteLimit: path.join(dataDir, "palette-limit.json")
    }
  };
}

const DEFAULT_CONFIG = createServerConfig();

function parseBooleanEnv(value) {
  if (value === undefined || value === null || value === "") return null;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function isPublicHost(host) {
  return Boolean(host && !["127.0.0.1", "localhost", "::1"].includes(String(host).toLowerCase()));
}

function hashSecret(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function verifyPassword(password, config = DEFAULT_CONFIG) {
  const incoming = Buffer.from(hashSecret(password));
  const expected = Buffer.from(config.auth.passwordHash);
  return incoming.length === expected.length && crypto.timingSafeEqual(incoming, expected);
}

function parseCookies(req) {
  const cookieHeader = req.headers?.cookie || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [decodeURIComponent(part), ""];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function isAuthenticated(req, config = DEFAULT_CONFIG) {
  if (!config.auth.enabled) return true;
  const cookies = parseCookies(req);
  return cookies[config.auth.cookieName] === config.auth.sessionToken;
}

function authCookieHeaders(config = DEFAULT_CONFIG) {
  return {
    "Set-Cookie": `${config.auth.cookieName}=${encodeURIComponent(config.auth.sessionToken)}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`
  };
}

function clearAuthCookieHeaders(config = DEFAULT_CONFIG) {
  return {
    "Set-Cookie": `${config.auth.cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
  };
}

function isAllowedStaticPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return (
    normalized === "index.html" ||
    normalized === "styles.css" ||
    normalized === "README.md" ||
    normalized === "使用手册.md" ||
    normalized.startsWith("src/") ||
    normalized.startsWith("defaults/")
  );
}

function createAppServer(options = {}) {
  const config = options.files ? options : createServerConfig(options);
  ensureDataDir(config);
  return http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url, config);
      return;
    }
    serveStatic(url.pathname, res, config);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});
}

function startServer(options = {}) {
  const host = options.host || process.env.PIXEL_TOY_HOST || process.env.HOST || "127.0.0.1";
  const publicMode = options.publicMode ?? parseBooleanEnv(process.env.PIXEL_TOY_PUBLIC_MODE || process.env.PINDOU_PUBLIC_MODE) ?? isPublicHost(host);
  const config = createServerConfig({ ...options, publicMode });
  const server = createAppServer(config);
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`端口 ${config.port} 已被占用。请打开 http://${host}:${config.port}`);
      rejectReady(error);
      return;
    }
    console.error(`本机服务启动失败：${error.message}`);
    rejectReady(error);
  });

  server.listen(config.port, host, () => {
    const actualPort = server.address().port;
    const url = `http://${host}:${actualPort}`;
    console.log(`拼豆设计工具已启动: ${url}`);
    resolveReady({ server, port: actualPort, url, dataDir: config.dataDir, rootDir: config.rootDir });
  });
  return { server, ready, config };
}

if (require.main === module) {
  startServer();
}

async function handleApi(req, res, url, config = DEFAULT_CONFIG) {
  if (req.method === "GET" && url.pathname === "/api/auth/status") {
    sendJson(res, 200, {
      required: config.auth.enabled,
      authenticated: !config.auth.enabled || isAuthenticated(req, config),
      publicMode: config.publicMode,
      mode: config.stateMode
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    if (!config.auth.enabled || verifyPassword(body.password || "", config)) {
      sendJson(res, 200, { ok: true }, config.auth.enabled ? authCookieHeaders(config) : {});
      return;
    }
    sendJson(res, 401, { ok: false, error: "访问密码不正确。" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    sendJson(res, 200, { ok: true }, clearAuthCookieHeaders(config));
    return;
  }

  if (config.auth.enabled && !isAuthenticated(req, config)) {
    sendJson(res, 401, { error: "需要先输入访问密码。" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    const settings = readJson(config.files.settings, null);
    sendJson(res, 200, {
      mode: config.stateMode,
      publicMode: config.publicMode,
      authRequired: config.auth.enabled,
      palette: readJson(config.files.palette, null),
      projects: readJson(config.files.projects, null),
      paletteLimit: readJson(config.files.paletteLimit, null),
      settings: maskSettings(settings)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/diagnostics") {
    const settings = readJson(config.files.settings, {});
    sendJson(res, 200, {
      mode: config.mode,
      publicMode: config.publicMode,
      authRequired: config.auth.enabled,
      version: "0.1.0",
      runtime: `Node ${process.version}`,
      dataDir: config.dataDir,
      dataFiles: {
        palette: fs.existsSync(config.files.palette),
        projects: fs.existsSync(config.files.projects),
        settings: fs.existsSync(config.files.settings),
        paletteLimit: fs.existsSync(config.files.paletteLimit)
      },
      activeAiConfig: maskSettings(settings)?.configs?.find((config) => config.id === maskSettings(settings)?.activeConfigId) || null
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/backup") {
    sendJson(res, 200, buildBackupPayload(config.mode, config));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open-data-dir") {
    if (config.publicMode) {
      sendJson(res, 403, { ok: false, error: "公网模式下不支持打开服务器数据目录，请使用备份功能。" });
      return;
    }
    openDataDir(config);
    sendJson(res, 200, { ok: true, dataDir: config.dataDir });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/restore") {
    const body = await readBody(req);
    const backup = normalizeBackupPayload(body);
    writeJson(config.files.palette, backup.palette, config);
    writeJson(config.files.projects, backup.projects, config);
    writeJson(config.files.paletteLimit, backup.paletteLimit, config);
    writeJson(config.files.settings, mergeSettings(readJson(config.files.settings, {}), backup.settings), config);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/palette") {
    const body = await readBody(req);
    writeJson(config.files.palette, body.palette || [], config);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/projects") {
    const body = await readBody(req);
    writeJson(config.files.projects, body.projects || [], config);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/palette-limit") {
    const body = await readBody(req);
    const limit = Math.min(999, Math.max(1, Number(body.paletteLimit) || 1));
    writeJson(config.files.paletteLimit, limit, config);
    sendJson(res, 200, { ok: true, paletteLimit: limit });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const body = await readBody(req);
    const existing = readJson(config.files.settings, {});
    const next = mergeSettings(existing, body);
    writeJson(config.files.settings, next, config);
    sendJson(res, 200, { ok: true, settings: maskSettings(next) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/test-ai") {
    const settings = getActiveConfig(readJson(config.files.settings, {}));
    const ok = settings.provider === "local" || Boolean(settings.apiKey);
    sendJson(res, ok ? 200 : 400, {
      ok,
      message: ok ? `AI 设置格式可用：${settings.name || settings.model}` : "请先保存 API Key，或切换为本地模拟。"
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/cartoonize") {
    const settings = readJson(config.files.settings, {});
    const body = await readBody(req);
    const result = await cartoonizeImage(body.imageDataUrl, settings);
    sendJson(res, result.imageDataUrl ? 200 : 200, result);
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

async function cartoonizeImage(imageDataUrl, settings) {
  settings = getActiveConfig(settings);
  if (!imageDataUrl) return { imageDataUrl: null, message: "没有收到图片。" };
  if (!settings.enabled || settings.provider === "local") {
    return { imageDataUrl: null, message: "当前为本地模拟模式。" };
  }
  if (!settings.apiKey) {
    return { imageDataUrl: null, message: "未保存 API Key，已回退到本地预处理。" };
  }

  if (settings.provider === "custom") {
    return callCustomImageEndpoint(imageDataUrl, settings);
  }

  return callOpenAiImageEdit(imageDataUrl, settings);
}

async function callOpenAiImageEdit(imageDataUrl, settings) {
  try {
    const form = new FormData();
    form.append("model", settings.model || "gpt-image-1.5");
    form.append("prompt", settings.prompt || "Convert this photo into a clean cartoon style with simple shapes and reduced color noise.");
    form.append("size", "1024x1024");
    form.append("quality", "low");
    form.append("image", dataUrlToBlob(imageDataUrl), "input.png");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      body: form
    });
    const payload = await response.json();
    if (!response.ok) {
      return { imageDataUrl: null, message: payload?.error?.message || "OpenAI 图像编辑调用失败。" };
    }
    return normalizeImageResponse(payload, "OpenAI 云端卡通化完成。");
  } catch (error) {
    return { imageDataUrl: null, message: `OpenAI 调用失败：${error.message}` };
  }
}

async function callCustomImageEndpoint(imageDataUrl, settings) {
  if (!settings.endpoint) return { imageDataUrl: null, message: "请先填写自定义端点。" };
  try {
    const response = await fetch(settings.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {})
      },
      body: JSON.stringify({
        imageDataUrl,
        model: settings.model,
        prompt: settings.prompt
      })
    });
    const payload = await response.json();
    if (!response.ok) return { imageDataUrl: null, message: payload?.error || "自定义模型端点调用失败。" };
    return normalizeImageResponse(payload, "自定义模型卡通化完成。");
  } catch (error) {
    return { imageDataUrl: null, message: `自定义模型调用失败：${error.message}` };
  }
}

function normalizeImageResponse(payload, message) {
  const direct = payload.imageDataUrl || payload.data_url;
  if (direct) return { imageDataUrl: direct, message };
  const b64 = payload.b64_json || payload.data?.[0]?.b64_json || payload.output?.[0]?.b64_json;
  if (b64) return { imageDataUrl: `data:image/png;base64,${b64}`, message };
  const url = payload.url || payload.data?.[0]?.url;
  if (url) return { imageDataUrl: null, message: "模型返回了图片 URL；当前本机服务需要 base64 输出，已回退到本地预处理。" };
  return { imageDataUrl: null, message: "模型返回格式无法识别，已回退到本地预处理。" };
}

function dataUrlToBlob(dataUrl) {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
  const bytes = Buffer.from(content, "base64");
  return new Blob([bytes], { type: mime });
}

function serveStatic(requestPath, res, config = DEFAULT_CONFIG) {
  const safePath = requestPath === "/" ? "/index.html" : decodeURIComponent(requestPath);
  const filePath = path.normalize(path.join(config.rootDir, safePath));
  const relativePath = path.relative(config.rootDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !isAllowedStaticPath(relativePath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

function ensureDataDir(config = DEFAULT_CONFIG) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const defaultsDir = path.join(config.rootDir, "defaults");
  for (const fileName of DATA_FILES) {
    const targetPath = path.join(config.dataDir, fileName);
    const sourcePath = path.join(defaultsDir, fileName);
    if (!fs.existsSync(targetPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value, config = DEFAULT_CONFIG) {
  ensureDataDir(config);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function maskSettings(settings) {
  if (!settings) return null;
  if (settings.configs?.length) {
    return {
      activeConfigId: settings.activeConfigId,
      configs: settings.configs.map(({ apiKey, ...config }) => ({ ...config, apiKeyPresent: Boolean(config.apiKeyPresent || apiKey) }))
    };
  }
  const { apiKey, ...safe } = settings;
  return { ...safe, apiKeyPresent: Boolean(apiKey) };
}

function mergeSettings(existing, incoming) {
  const existingNormalized = normalizeSettings(existing);
  const incomingNormalized = normalizeSettings(incoming);
  const existingById = new Map(existingNormalized.configs.map((config) => [config.id, config]));
  const configs = incomingNormalized.configs.map((config) => {
    const previous = existingById.get(config.id);
    return {
      ...config,
      apiKey: config.apiKey || previous?.apiKey || ""
    };
  });
  return {
    activeConfigId: incomingNormalized.activeConfigId,
    configs
  };
}

function normalizeSettings(settings = {}) {
  if (settings.configs?.length) {
    return {
      activeConfigId: settings.activeConfigId || settings.configs[0].id,
      configs: settings.configs.map((config) => ({
        id: config.id || `model-${Date.now()}`,
        name: config.name || `${config.provider || "local"} · ${config.model || "local-cartoon-preprocess"}`,
        provider: config.provider || "local",
        model: config.model || "local-cartoon-preprocess",
        endpoint: config.endpoint || "",
        prompt: config.prompt || "",
        enabled: Boolean(config.enabled),
        apiKey: config.apiKey || "",
        apiKeyPresent: Boolean(config.apiKeyPresent || config.apiKey)
      }))
    };
  }
  const config = {
    id: "legacy-config",
    name: `${settings.provider || "local"} · ${settings.model || "local-cartoon-preprocess"}`,
    provider: settings.provider || "local",
    model: settings.model || "local-cartoon-preprocess",
    endpoint: settings.endpoint || "",
    prompt: settings.prompt || "",
    enabled: Boolean(settings.enabled),
    apiKey: settings.apiKey || "",
    apiKeyPresent: Boolean(settings.apiKeyPresent || settings.apiKey)
  };
  return { activeConfigId: config.id, configs: [config] };
}

function getActiveConfig(settings) {
  const normalized = normalizeSettings(settings);
  return normalized.configs.find((config) => config.id === normalized.activeConfigId) || normalized.configs[0];
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 25 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json;charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function buildBackupPayload(mode, config = DEFAULT_CONFIG) {
  return {
    type: "pixel-toy-full-backup",
    version: 1,
    mode,
    exportedAt: new Date().toISOString(),
    palette: readJson(config.files.palette, []),
    projects: readJson(config.files.projects, []),
    paletteLimit: readJson(config.files.paletteLimit, null),
    settings: maskSettings(readJson(config.files.settings, null))
  };
}

function normalizeBackupPayload(payload) {
  if (!payload || payload.type !== "pixel-toy-full-backup") {
    throw new Error("Invalid full backup");
  }
  return {
    palette: Array.isArray(payload.palette) ? payload.palette : [],
    projects: Array.isArray(payload.projects) ? payload.projects : [],
    paletteLimit: Math.min(999, Math.max(1, Number(payload.paletteLimit) || 1)),
    settings: normalizeSettings(payload.settings || {})
  };
}

function openDataDir(config = DEFAULT_CONFIG) {
  ensureDataDir(config);
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  spawn(opener, [config.dataDir], { detached: true, stdio: "ignore" }).unref();
}

module.exports = {
  createServerConfig,
  createAppServer,
  startServer,
  handleApi,
  isAuthenticated,
  cartoonizeImage,
  normalizeImageResponse,
  normalizeSettings,
  mergeSettings,
  maskSettings,
  getActiveConfig,
  buildBackupPayload,
  normalizeBackupPayload
};
