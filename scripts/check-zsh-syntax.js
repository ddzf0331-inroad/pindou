const { spawnSync } = require("child_process");

const files = ["scripts/launch-macos.zsh", "打开拼豆设计.command", "拼豆设计.app/Contents/MacOS/拼豆设计"];

for (const file of files) {
  const result = spawnSync("zsh", ["-n", file], { encoding: "utf8" });
  const stderr = (result.stderr || "")
    .split("\n")
    .filter((line) => line && !line.includes("nice(5) failed"))
    .join("\n");

  if (result.status !== 0) {
    if (stderr) process.stderr.write(`${stderr}\n`);
    process.exit(result.status || 1);
  }

  if (stderr) process.stderr.write(`${stderr}\n`);
}

console.log(`Zsh syntax check passed: ${files.length} files.`);
