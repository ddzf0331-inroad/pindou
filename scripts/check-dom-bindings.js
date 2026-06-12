const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const js = fs.readFileSync("src/app.js", "utf8");

const bindBlock = js.match(/function bindElements\(\) \{\s*\[([\s\S]*?)\]\.forEach/);
if (!bindBlock) {
  throw new Error("Cannot find bindElements id list.");
}

const ids = [...bindBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const missing = ids.filter((id) => !new RegExp(`id=["']${id}["']`).test(html));

if (missing.length) {
  throw new Error(`Missing DOM ids: ${missing.join(", ")}`);
}

console.log(`DOM binding check passed: ${ids.length} ids.`);
