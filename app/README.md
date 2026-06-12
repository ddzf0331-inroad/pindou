# 拼豆设计 App 端开发目录

这个目录是移动端独立工程，采用原生 WebView 壳打包现有静态网页能力，并为 Android / iOS 分别接入系统级导入导出。

## 当前范围

- `android-app/`：Android 应用模块，入口是 `com.pixeltoy.designer.MainActivity`。
- `android-app/src/main/assets/`：移动端内置网页资源，由同步脚本从主项目复制。
- `ios-app/`：iOS 应用工程，入口是 `PixelToyDesignerApp`，使用 `WKWebView` 加载内置网页资源。
- `scripts/sync-web-assets.js`：把根目录的 `index.html`、`styles.css`、`src/app.js` 和 `defaults/` 同步到 Android assets 与 iOS WebAssets。

## 开发方式

1. 在项目根目录同步网页资源：

   ```bash
   npm run app:sync
   ```

2. 用 Android Studio 打开这个 `app/` 文件夹。

3. 等待 Android Studio 安装/同步 Gradle 与 Android SDK 后运行 `android-app`。

4. 命令行构建可在项目根目录执行：

   ```bash
  npm run app:build
  ```

  成功后 APK 会输出到 `app/release/拼豆设计-android.apk`，可通过微信、网盘或数据线发给别人安装。当前 release 包使用 Android 调试证书签名，适合小范围试装，不适合上架应用商店。

5. 构建 iOS 安装包需要完整 Xcode、Apple Developer Team ID，以及可安装目标设备的开发或 Ad Hoc 签名配置：

   ```bash
   npm run app:doctor:ios
   IOS_TEAM_ID=你的TeamID npm run app:build:ios
   ```

   如个人 Team 不能使用默认包名，可换成自己的唯一包名：

   ```bash
   IOS_TEAM_ID=你的TeamID IOS_BUNDLE_ID=com.fzhao.pindou.pixeltoy npm run app:build:ios
   ```

   成功后 IPA 会输出到 `app/release/拼豆设计-ios.ipa`。如果使用 development 签名，目标 iPhone 需要已加入开发设备；如需分发给更多设备，请改用 Ad Hoc、TestFlight 或企业签名。

## 已接入的手机端能力

- 图片选择：网页里的“导入图片”会调用 Android 系统图片选择器。
- iOS 图片选择：网页里的“导入图片”会调用 WKWebView 的系统照片/文件选择能力。
- 本地存储：WebView 开启 DOM Storage，作品、色库和设置会保存在 app 本地。
- 默认数据：首次静态启动会尝试载入 `defaults/` 中的完整色库、示例图库和设置。
- 文件导出：网页导出的 PNG、CSV、JSON、HTML 会保存到系统“下载/拼豆设计”目录。
- iOS 文件导出：网页导出的 PNG、CSV、JSON、HTML 会交给原生分享面板，可保存到“文件”、隔空投送或发送到其他 App。

## 后续开发建议

- 接入 Android 分享面板，导出后可直接分享生产文件。
- 增加相册/相机来源选择。
- 把 AI 设置里的 API Key 改为 Android Keystore 保存。
- 如需账号同步，再增加原生网络层或迁移到 Capacitor/React Native 等方案。
