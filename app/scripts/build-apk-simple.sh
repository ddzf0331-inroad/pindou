#!/usr/bin/env zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/.." && pwd)"
MODULE_DIR="$APP_DIR/android-app"
BUILD_DIR="$MODULE_DIR/build/simple"
OUTPUT_DIR="$APP_DIR/release"
OUTPUT_APK="$OUTPUT_DIR/拼豆设计-android.apk"

JAVA_HOME_CANDIDATE="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
ANDROID_HOME_CANDIDATE="$HOME/Library/Android/sdk"

export JAVA_HOME="${JAVA_HOME:-$JAVA_HOME_CANDIDATE}"
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_HOME_CANDIDATE}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

PLATFORM_DIR="$(find "$ANDROID_HOME/platforms" -maxdepth 1 -type d -name 'android-*' | sort -V | tail -1)"
BUILD_TOOLS_DIR="$(find "$ANDROID_HOME/build-tools" -maxdepth 1 -type d | sort -V | tail -1)"

if [[ ! -x "$JAVA_HOME/bin/javac" ]]; then
  echo "未找到 JDK。请确认 Android Studio 已安装，或设置 JAVA_HOME。"
  exit 1
fi

if [[ -z "$PLATFORM_DIR" || ! -f "$PLATFORM_DIR/android.jar" ]]; then
  echo "未找到 Android platform。请在 Android Studio 里安装 Android SDK Platform。"
  exit 1
fi

if [[ ! -x "$BUILD_TOOLS_DIR/aapt2" || ! -x "$BUILD_TOOLS_DIR/d8" || ! -x "$BUILD_TOOLS_DIR/apksigner" ]]; then
  echo "未找到完整 Android build-tools。请在 Android Studio 里安装 Android SDK Build-Tools。"
  exit 1
fi

cd "$ROOT_DIR"
npm run app:sync

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/compiled-res" "$BUILD_DIR/generated" "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$OUTPUT_DIR"

"$BUILD_TOOLS_DIR/aapt2" compile --dir "$MODULE_DIR/src/main/res" -o "$BUILD_DIR/compiled-res"
"$BUILD_TOOLS_DIR/aapt2" link \
  -o "$BUILD_DIR/app-unsigned.apk" \
  -I "$PLATFORM_DIR/android.jar" \
  --manifest "$MODULE_DIR/src/main/AndroidManifest.xml" \
  --java "$BUILD_DIR/generated" \
  --min-sdk-version 29 \
  --target-sdk-version 36 \
  --version-code 1 \
  --version-name 0.1.0 \
  -A "$MODULE_DIR/src/main/assets" \
  "$BUILD_DIR/compiled-res"/*.flat

find "$BUILD_DIR/generated" "$MODULE_DIR/src/main/java" -name '*.java' > "$BUILD_DIR/sources.txt"
"$JAVA_HOME/bin/javac" \
  -encoding UTF-8 \
  -source 8 \
  -target 8 \
  -bootclasspath "$PLATFORM_DIR/android.jar" \
  -d "$BUILD_DIR/classes" \
  @"$BUILD_DIR/sources.txt"

"$JAVA_HOME/bin/jar" cf "$BUILD_DIR/classes.jar" -C "$BUILD_DIR/classes" .

"$BUILD_TOOLS_DIR/d8" \
  --lib "$PLATFORM_DIR/android.jar" \
  --min-api 29 \
  --output "$BUILD_DIR/dex" \
  "$BUILD_DIR/classes.jar"

cd "$BUILD_DIR/dex"
zip -q -u "$BUILD_DIR/app-unsigned.apk" classes.dex
cd "$ROOT_DIR"

"$BUILD_TOOLS_DIR/zipalign" -f -p 4 "$BUILD_DIR/app-unsigned.apk" "$BUILD_DIR/app-aligned.apk"

KEYSTORE="$APP_DIR/release/debug-install-key.jks"
if [[ ! -f "$KEYSTORE" ]]; then
  "$JAVA_HOME/bin/keytool" -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Pixel Toy,C=CN" >/dev/null
fi

"$BUILD_TOOLS_DIR/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$OUTPUT_APK" \
  "$BUILD_DIR/app-aligned.apk"

"$BUILD_TOOLS_DIR/apksigner" verify --verbose "$OUTPUT_APK"

echo "APK 已生成：$OUTPUT_APK"
