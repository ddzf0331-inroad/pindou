const fs = require("fs");
const { execFileSync } = require("child_process");

const required = [
  "打开拼豆设计.command",
  "打开拼豆设计.bat",
  "scripts/launch-macos.zsh",
  "scripts/launch-unix.sh",
  "拼豆设计.app/Contents/MacOS/拼豆设计",
  "拼豆设计.app/Contents/Info.plist",
  "使用手册.md"
];
const executable = ["打开拼豆设计.command", "scripts/launch-macos.zsh", "scripts/launch-unix.sh", "拼豆设计.app/Contents/MacOS/拼豆设计"];

const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) {
  throw new Error(`Missing launcher files: ${missing.join(", ")}`);
}

for (const file of executable) {
  const mode = fs.statSync(file).mode;
  if ((mode & 0o111) === 0) {
    throw new Error(`Launcher is not executable: ${file}`);
  }
}

execFileSync("sh", ["-n", "scripts/launch-unix.sh"], { stdio: "pipe" });

const windowsLauncher = fs.readFileSync("打开拼豆设计.bat", "utf8");
for (const token of ["server.js", "server.py", "index.html", "http://127.0.0.1:4173"]) {
  if (!windowsLauncher.includes(token)) {
    throw new Error(`Windows launcher missing token: ${token}`);
  }
}

console.log(`Launcher check passed: ${required.length} files.`);
