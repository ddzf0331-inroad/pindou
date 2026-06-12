const assert = require("assert");

const { cartoonizeImage, normalizeImageResponse } = require("../server.js");

async function main() {
  const imageDataUrl = "data:image/png;base64,aW1hZ2U=";

  let result = await cartoonizeImage(imageDataUrl, {
    activeConfigId: "local",
    configs: [{ id: "local", provider: "local", model: "local", enabled: false }]
  });
  assert.strictEqual(result.imageDataUrl, null, "local mode should fall back");
  assert.match(result.message, /本地模拟/);

  result = await cartoonizeImage(imageDataUrl, {
    activeConfigId: "openai",
    configs: [{ id: "openai", provider: "openai", model: "gpt-image-1.5", enabled: true, apiKey: "" }]
  });
  assert.strictEqual(result.imageDataUrl, null, "missing key should fall back");
  assert.match(result.message, /未保存 API Key/);

  result = normalizeImageResponse({ data: [{ b64_json: "YWJj" }] }, "ok");
  assert.strictEqual(result.imageDataUrl, "data:image/png;base64,YWJj", "b64_json should become data URL");

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ imageDataUrl: "data:image/png;base64,ZmFrZQ==" })
  });
  try {
    result = await cartoonizeImage(imageDataUrl, {
      activeConfigId: "custom",
      configs: [
        {
          id: "custom",
          provider: "custom",
          model: "cartoon",
          endpoint: "https://example.invalid/cartoon",
          prompt: "cartoon",
          enabled: true,
          apiKey: "secret"
        }
      ]
    });
    assert.strictEqual(result.imageDataUrl, "data:image/png;base64,ZmFrZQ==", "custom endpoint data URL should pass through");
  } finally {
    global.fetch = originalFetch;
  }

  console.log("AI pipeline check passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
