package com.pixeltoy.designer;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.HapticFeedbackConstants;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);
        configureWebView();
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.addJavascriptInterface(new AndroidBridge(), "PixelToyAndroid");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                startActivityForResult(Intent.createChooser(intent, "选择图片"), FILE_CHOOSER_REQUEST);
                return true;
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            results = new Uri[] { data.getData() };
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void downloadFile(String dataUrl, String filename) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    saveDataUrl(dataUrl, filename);
                }
            });
        }

        @JavascriptInterface
        public void notify(String type) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (webView == null) return;
                    int feedback = "error".equals(type)
                            ? HapticFeedbackConstants.REJECT
                            : HapticFeedbackConstants.CONFIRM;
                    webView.performHapticFeedback(feedback);
                }
            });
        }
    }

    private void saveDataUrl(String dataUrl, String filename) {
        try {
            DataUrlPayload payload = parseDataUrl(dataUrl);
            String safeName = sanitizeFilename(filename);
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
            values.put(MediaStore.Downloads.MIME_TYPE, payload.mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, "Download/拼豆设计");

            ContentResolver resolver = getContentResolver();
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Cannot create download item");

            try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                if (outputStream == null) throw new IllegalStateException("Cannot open download item");
                outputStream.write(payload.bytes);
            }
            Toast.makeText(this, "已保存到下载/拼豆设计/" + safeName, Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this, "保存失败：" + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private DataUrlPayload parseDataUrl(String dataUrl) {
        if (dataUrl == null || !dataUrl.startsWith("data:")) {
            throw new IllegalArgumentException("不是可保存的文件数据");
        }
        int commaIndex = dataUrl.indexOf(',');
        if (commaIndex < 0) throw new IllegalArgumentException("文件数据格式不正确");

        String header = dataUrl.substring(5, commaIndex).toLowerCase(Locale.ROOT);
        String mimeType = header.split(";")[0];
        String body = dataUrl.substring(commaIndex + 1);
        byte[] bytes = header.contains(";base64")
                ? Base64.decode(body, Base64.DEFAULT)
                : Uri.decode(body).getBytes(StandardCharsets.UTF_8);
        return new DataUrlPayload(mimeType.isEmpty() ? "application/octet-stream" : mimeType, bytes);
    }

    private String sanitizeFilename(String filename) {
        String fallback = "pixel-toy-" + System.currentTimeMillis();
        String value = filename == null || filename.trim().isEmpty() ? fallback : filename.trim();
        return value.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private static class DataUrlPayload {
        final String mimeType;
        final byte[] bytes;

        DataUrlPayload(String mimeType, byte[] bytes) {
            this.mimeType = mimeType;
            this.bytes = bytes;
        }
    }
}
