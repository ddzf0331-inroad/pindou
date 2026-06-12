#!/usr/bin/env zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/.." && pwd)"
TOOL_DIR="$APP_DIR/.android-build"
LOCAL_JAVA_HOME="$TOOL_DIR/jdk"
LOCAL_ANDROID_HOME="$TOOL_DIR/android-sdk"
LOCAL_GRADLE="$TOOL_DIR/gradle/bin/gradle"
LOCAL_GRADLE_HOME="$TOOL_DIR/gradle-home"
ANDROID_STUDIO_JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
USER_ANDROID_HOME="$HOME/Library/Android/sdk"
OUTPUT_DIR="$APP_DIR/release"
OUTPUT_APK="$OUTPUT_DIR/拼豆设计-android.apk"

export GRADLE_USER_HOME="$LOCAL_GRADLE_HOME"

if [[ -x "$LOCAL_JAVA_HOME/Contents/Home/bin/java" ]]; then
  export JAVA_HOME="$LOCAL_JAVA_HOME/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
elif [[ -x "$LOCAL_JAVA_HOME/bin/java" ]]; then
  export JAVA_HOME="$LOCAL_JAVA_HOME"
  export PATH="$JAVA_HOME/bin:$PATH"
elif [[ -x "$ANDROID_STUDIO_JAVA_HOME/bin/java" ]]; then
  export JAVA_HOME="$ANDROID_STUDIO_JAVA_HOME"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [[ -d "$LOCAL_ANDROID_HOME" ]]; then
  export ANDROID_HOME="$LOCAL_ANDROID_HOME"
  export ANDROID_SDK_ROOT="$LOCAL_ANDROID_HOME"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
elif [[ -d "$USER_ANDROID_HOME" ]]; then
  export ANDROID_HOME="$USER_ANDROID_HOME"
  export ANDROID_SDK_ROOT="$USER_ANDROID_HOME"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
fi

cd "$ROOT_DIR"
npm run app:sync

cd "$APP_DIR"

if [[ -x "./gradlew" ]]; then
  GRADLE_CMD="./gradlew"
elif [[ -x "$LOCAL_GRADLE" ]]; then
  GRADLE_CMD="$LOCAL_GRADLE"
elif command -v gradle >/dev/null 2>&1; then
  GRADLE_CMD="gradle"
else
  echo "未找到 Gradle。可先运行 app/scripts/install-build-tools.sh 安装项目内构建工具。"
  exit 1
fi

"$GRADLE_CMD" :android-app:assembleRelease --console=plain

mkdir -p "$OUTPUT_DIR"
cp "$APP_DIR/android-app/build/outputs/apk/release/android-app-release.apk" "$OUTPUT_APK"

echo "APK 已生成：$OUTPUT_APK"
