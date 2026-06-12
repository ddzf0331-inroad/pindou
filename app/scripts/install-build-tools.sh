#!/usr/bin/env zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TOOL_DIR="$APP_DIR/.android-build"
DOWNLOAD_DIR="$TOOL_DIR/downloads"
JDK_DIR="$TOOL_DIR/jdk"
GRADLE_DIR="$TOOL_DIR/gradle"
ANDROID_HOME_DIR="$TOOL_DIR/android-sdk"

JDK_URL="https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse?project=jdk"
GRADLE_URL="https://services.gradle.org/distributions/gradle-8.7-bin.zip"
ANDROID_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-mac-14742923_latest.zip"

mkdir -p "$DOWNLOAD_DIR" "$ANDROID_HOME_DIR"

download() {
  local url="$1"
  local output="$2"
  if [[ ! -f "$output" ]]; then
    curl -L --fail --retry 3 --output "$output" "$url"
  fi
}

if [[ ! -x "$JDK_DIR/Contents/Home/bin/java" && ! -x "$JDK_DIR/bin/java" ]]; then
  echo "下载 JDK 17..."
  download "$JDK_URL" "$DOWNLOAD_DIR/jdk17.tar.gz"
  rm -rf "$TOOL_DIR"/jdk-17-* "$JDK_DIR"
  mkdir -p "$TOOL_DIR/jdk-unpack"
  tar -xzf "$DOWNLOAD_DIR/jdk17.tar.gz" -C "$TOOL_DIR/jdk-unpack"
  mv "$TOOL_DIR"/jdk-unpack/* "$JDK_DIR"
  rmdir "$TOOL_DIR/jdk-unpack"
fi

if [[ ! -x "$GRADLE_DIR/bin/gradle" ]]; then
  echo "下载 Gradle 8.7..."
  download "$GRADLE_URL" "$DOWNLOAD_DIR/gradle-8.7-bin.zip"
  rm -rf "$TOOL_DIR/gradle-8.7" "$GRADLE_DIR"
  unzip -q "$DOWNLOAD_DIR/gradle-8.7-bin.zip" -d "$TOOL_DIR"
  mv "$TOOL_DIR/gradle-8.7" "$GRADLE_DIR"
fi

if [[ ! -x "$ANDROID_HOME_DIR/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "下载 Android 命令行工具..."
  download "$ANDROID_TOOLS_URL" "$DOWNLOAD_DIR/commandlinetools-mac.zip"
  rm -rf "$ANDROID_HOME_DIR/cmdline-tools"
  mkdir -p "$ANDROID_HOME_DIR/cmdline-tools"
  unzip -q "$DOWNLOAD_DIR/commandlinetools-mac.zip" -d "$ANDROID_HOME_DIR/cmdline-tools"
  mv "$ANDROID_HOME_DIR/cmdline-tools/cmdline-tools" "$ANDROID_HOME_DIR/cmdline-tools/latest"
fi

if [[ -x "$JDK_DIR/Contents/Home/bin/java" ]]; then
  export JAVA_HOME="$JDK_DIR/Contents/Home"
else
  export JAVA_HOME="$JDK_DIR"
fi
export ANDROID_HOME="$ANDROID_HOME_DIR"
export ANDROID_SDK_ROOT="$ANDROID_HOME_DIR"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

yes | sdkmanager --licenses >/dev/null
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

echo "构建工具已安装到 $TOOL_DIR"
