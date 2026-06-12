#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_PATH="$ROOT_DIR/app/ios-app/PixelToyDesigner.xcodeproj"
SCHEME="PixelToyDesigner"
CONFIGURATION="${IOS_CONFIGURATION:-Release}"
TEAM_ID="${IOS_TEAM_ID:-FC82KN53F6}"
BUNDLE_ID="${IOS_BUNDLE_ID:-com.fzhao.pindou.pixeltoy}"
EXPORT_METHOD="${IOS_EXPORT_METHOD:-development}"
BUILD_DIR="$ROOT_DIR/app/ios-app/build"
DERIVED_DATA_PATH="$BUILD_DIR/DerivedData"
ARCHIVE_PATH="$BUILD_DIR/PixelToyDesigner.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS="$BUILD_DIR/ExportOptions.plist"
ARCHIVE_LOG="$BUILD_DIR/archive.log"
EXPORT_LOG="$BUILD_DIR/export.log"
FINAL_DIR="$ROOT_DIR/app/release"
FINAL_IPA="$FINAL_DIR/拼豆设计-ios.ipa"

"$ROOT_DIR/app/scripts/check-ios-env.sh"

if [[ -z "$TEAM_ID" ]]; then
  echo "缺少 IOS_TEAM_ID。可在 Apple Developer 账号中查看 Team ID。"
  echo "示例：IOS_TEAM_ID=ABCDE12345 npm run app:build:ios"
  exit 1
fi

PROFILE_DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
if [[ -d "$PROFILE_DIR" ]]; then
  for profile in "$PROFILE_DIR"/*.mobileprovision(N); do
    if ! security cms -D -i "$profile" >/dev/null 2>&1; then
      echo "提示：当前受限环境无法解码 Xcode 描述文件：$profile"
      echo "如果 Xcode Signing 页面已显示 Xcode Managed Profile，可继续由 xcodebuild 判断签名是否有效。"
    fi
  done
fi

cd "$ROOT_DIR"
npm run app:sync

mkdir -p "$BUILD_DIR" "$EXPORT_PATH" "$FINAL_DIR"

cat > "$EXPORT_OPTIONS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>$EXPORT_METHOD</string>
  <key>teamID</key>
  <string>$TEAM_ID</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>stripSwiftSymbols</key>
  <true/>
</dict>
</plist>
PLIST

set +e
xcodebuild archive \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates 2>&1 | tee "$ARCHIVE_LOG"
ARCHIVE_STATUS=${pipestatus[1]}
set -e

if [[ "$ARCHIVE_STATUS" -ne 0 ]]; then
  if grep -q "No Account for Team" "$ARCHIVE_LOG"; then
    echo ""
    echo "打包失败：Xcode 当前登录账号不属于 Team $TEAM_ID。"
    echo "请在 Xcode > Settings > Accounts 中查看当前账号实际 Team ID，然后用："
    echo "IOS_TEAM_ID=实际TeamID IOS_BUNDLE_ID=com.yourname.pixeltoy npm run app:build:ios"
  elif grep -q "No profiles for" "$ARCHIVE_LOG"; then
    echo ""
    echo "打包失败：没有找到 Bundle ID $BUNDLE_ID 对应的 iOS Development 描述文件。"
    echo "如果 Xcode Signing 页面已经显示 Xcode Managed Profile，请在系统终端运行同一条命令，或用 Xcode Product > Archive。"
    echo "如果 Xcode Signing 页面仍报包名错误，再换唯一包名重试："
    echo "IOS_TEAM_ID=$TEAM_ID IOS_BUNDLE_ID=com.yourname.pixeltoy npm run app:build:ios"
  fi
  exit "$ARCHIVE_STATUS"
fi

set +e
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_PATH" \
  -allowProvisioningUpdates 2>&1 | tee "$EXPORT_LOG"
EXPORT_STATUS=${pipestatus[1]}
set -e

if [[ "$EXPORT_STATUS" -ne 0 ]]; then
  echo "IPA 导出失败，请查看日志：$EXPORT_LOG"
  exit "$EXPORT_STATUS"
fi

IPA_PATH="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' -print -quit)"
if [[ -z "$IPA_PATH" ]]; then
  echo "Xcode 导出完成但没有找到 IPA 文件。"
  exit 1
fi

cp "$IPA_PATH" "$FINAL_IPA"
echo "iOS 安装包已生成：$FINAL_IPA"
