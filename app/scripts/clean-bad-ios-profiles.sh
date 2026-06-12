#!/usr/bin/env zsh
set -euo pipefail

PROFILE_DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"

if [[ ! -d "$PROFILE_DIR" ]]; then
  echo "没有找到 Xcode provisioning profile 目录：$PROFILE_DIR"
  exit 0
fi

FOUND=0
for profile in "$PROFILE_DIR"/*.mobileprovision(N); do
  if ! security cms -D -i "$profile" >/dev/null 2>&1; then
    FOUND=1
    backup="$profile.broken"
    counter=1
    while [[ -e "$backup" ]]; do
      backup="$profile.broken.$counter"
      counter=$((counter + 1))
    done
    mv "$profile" "$backup"
    echo "已移走损坏描述文件：$profile"
    echo "备份为：$backup"
  fi
done

if [[ "$FOUND" -eq 0 ]]; then
  echo "未发现损坏的 Xcode 描述文件。"
else
  echo "请回到 Xcode 的 Signing & Capabilities，保持真机连接并点 Try Again。"
fi
