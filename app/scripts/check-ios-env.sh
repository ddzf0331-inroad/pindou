#!/usr/bin/env zsh
set -euo pipefail

DEVELOPER_DIR="$(xcode-select -p 2>/dev/null || true)"

if [[ -z "$DEVELOPER_DIR" || "$DEVELOPER_DIR" != *"/Xcode.app/Contents/Developer" ]]; then
  echo "iOS 构建环境未就绪：当前 Command Line Tools 指向 ${DEVELOPER_DIR:-未设置}。"
  echo "请安装完整 Xcode，然后在 Xcode > Settings > Locations 里选择 Command Line Tools。"
  echo "也可以运行：sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

if ! xcrun --sdk iphoneos --show-sdk-path >/dev/null 2>&1; then
  echo "没有找到 iPhoneOS SDK。请打开 Xcode 完成组件安装后重试。"
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "xcodebuild 不可用。请确认 Xcode 已安装并完成首次启动配置。"
  exit 1
fi

IDENTITIES="$(security find-identity -v -p codesigning 2>/dev/null || true)"
if [[ "$IDENTITIES" == *"0 valid identities found"* ]]; then
  echo "提示：当前钥匙串没有可用的 Apple 代码签名证书。"
  echo "首次打包可由 Xcode 自动创建，但需要先在 Xcode > Settings > Accounts 登录 Apple ID，并提供 IOS_TEAM_ID。"
else
  echo "已发现可用代码签名证书。"
fi

echo "iOS 构建环境检查通过。"
