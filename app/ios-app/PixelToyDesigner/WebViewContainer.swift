import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebKit

struct WebViewContainer: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> PixelToyWebViewController {
        PixelToyWebViewController()
    }

    func updateUIViewController(_ uiViewController: PixelToyWebViewController, context: Context) {}
}

final class PixelToyWebViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    private var webView: WKWebView?
    private let messageHandlerName = "PixelToyIOS"
    private var pendingExportURLs: [URL] = []
    private var exportPresentationTimer: Timer?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let configuration = WKWebViewConfiguration()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        if #available(iOS 14.0, *) {
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        }

        let userContentController = WKUserContentController()
        userContentController.add(WeakScriptMessageHandler(delegate: self), name: messageHandlerName)
        userContentController.addUserScript(WKUserScript(source: bundledDefaultsScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        userContentController.addUserScript(WKUserScript(source: iosBridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        self.webView = webView
        loadBundledApp()
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: messageHandlerName)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == messageHandlerName,
              let payload = message.body as? [String: Any] else {
            return
        }

        if (payload["action"] as? String) == "notify" {
            notifyFeedback(type: (payload["type"] as? String) ?? "success")
            return
        }

        guard let dataUrl = payload["dataUrl"] as? String else { return }
        let filename = (payload["filename"] as? String) ?? "pixel-toy-export"
        exportDataUrl(dataUrl, filename: filename)
    }

    private var iosBridgeScript: String {
        """
        window.PixelToyIOS = {
          downloadFile: function(dataUrl, filename) {
            window.webkit.messageHandlers.PixelToyIOS.postMessage({
              action: "download",
              dataUrl: dataUrl,
              filename: filename || "pixel-toy-export"
            });
          },
          notify: function(type) {
            window.webkit.messageHandlers.PixelToyIOS.postMessage({
              action: "notify",
              type: type || "success"
            });
          }
        };
        if (document.documentElement) {
          document.documentElement.classList.add("ios-webview");
        } else {
          document.addEventListener("DOMContentLoaded", function() {
            document.documentElement.classList.add("ios-webview");
          });
        }
        document.addEventListener("gesturestart", function(event) {
          event.preventDefault();
        }, { passive: false });
        """
    }

    private var bundledDefaultsScript: String {
        let defaultFiles = [
            "defaults/manifest.json",
            "defaults/palette.json",
            "defaults/projects.json",
            "defaults/palette-limit.json",
            "defaults/settings.json"
        ]
        let entries = defaultFiles.compactMap { relativePath -> String? in
            guard let json = readWebAsset(relativePath) else { return nil }
            return "\"\(relativePath)\": \(json)"
        }
        return """
        window.PixelToyBundledDefaults = {
          \(entries.joined(separator: ",\n  "))
        };
        """
    }

    private func loadBundledApp() {
        guard let webRoot = Bundle.main.resourceURL?.appendingPathComponent("WebAssets", isDirectory: true),
              let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets") else {
            showAlert(title: "资源缺失", message: "没有找到内置网页资源，请先运行移动端资源同步。")
            return
        }

        webView?.loadFileURL(indexURL, allowingReadAccessTo: webRoot)
    }

    private func readWebAsset(_ relativePath: String) -> String? {
        guard let webRoot = Bundle.main.resourceURL?.appendingPathComponent("WebAssets", isDirectory: true) else {
            return nil
        }
        let fileURL = webRoot.appendingPathComponent(relativePath)
        return try? String(contentsOf: fileURL, encoding: .utf8)
    }

    private func exportDataUrl(_ dataUrl: String, filename: String) {
        do {
            let payload = try DataUrlPayload(dataUrl: dataUrl)
            let fileURL = try writeExportFile(payload: payload, filename: filename)
            queueShareSheet(for: fileURL)
        } catch {
            showAlert(title: "导出失败", message: error.localizedDescription)
        }
    }

    private func writeExportFile(payload: DataUrlPayload, filename: String) throws -> URL {
        let exportDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("PixelToyDesignerExports", isDirectory: true)
        try FileManager.default.createDirectory(at: exportDirectory, withIntermediateDirectories: true)

        var safeName = sanitizeFilename(filename)
        if (safeName as NSString).pathExtension.isEmpty,
           let fileExtension = UTType(mimeType: payload.mimeType)?.preferredFilenameExtension {
            safeName += ".\(fileExtension)"
        }

        let fileURL = exportDirectory.appendingPathComponent(safeName)
        try payload.data.write(to: fileURL, options: .atomic)
        return fileURL
    }

    private func queueShareSheet(for fileURL: URL) {
        pendingExportURLs.append(fileURL)
        exportPresentationTimer?.invalidate()
        exportPresentationTimer = Timer.scheduledTimer(withTimeInterval: 0.45, repeats: false) { [weak self] _ in
            self?.presentPendingShareSheet()
        }
    }

    private func presentPendingShareSheet() {
        guard !pendingExportURLs.isEmpty else { return }

        if presentedViewController != nil {
            exportPresentationTimer = Timer.scheduledTimer(withTimeInterval: 0.45, repeats: false) { [weak self] _ in
                self?.presentPendingShareSheet()
            }
            return
        }

        let files = pendingExportURLs
        pendingExportURLs.removeAll()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        let activityViewController = UIActivityViewController(activityItems: files, applicationActivities: nil)
        if let popover = activityViewController.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        present(activityViewController, animated: true)
    }

    private func notifyFeedback(type: String) {
        if type == "error" {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } else if type == "warn" {
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        } else {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func sanitizeFilename(_ filename: String) -> String {
        let trimmed = filename.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = "pixel-toy-\(Int(Date().timeIntervalSince1970))"
        let value = trimmed.isEmpty ? fallback : trimmed
        let forbidden = CharacterSet(charactersIn: "\\/:*?\"<>|")
        return value.components(separatedBy: forbidden).joined(separator: "_")
    }

    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default))
        present(alert, animated: true)
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

private struct DataUrlPayload {
    let mimeType: String
    let data: Data

    init(dataUrl: String) throws {
        guard dataUrl.hasPrefix("data:"),
              let commaIndex = dataUrl.firstIndex(of: ",") else {
            throw ExportError.invalidDataUrl
        }

        let header = String(dataUrl[dataUrl.index(dataUrl.startIndex, offsetBy: 5)..<commaIndex]).lowercased()
        let body = String(dataUrl[dataUrl.index(after: commaIndex)...])
        let mimeType = header.split(separator: ";").first.map(String.init) ?? "application/octet-stream"

        if header.contains(";base64") {
            guard let decoded = Data(base64Encoded: body, options: .ignoreUnknownCharacters) else {
                throw ExportError.invalidDataUrl
            }
            self.data = decoded
        } else {
            let decoded = body.removingPercentEncoding ?? body
            self.data = Data(decoded.utf8)
        }

        self.mimeType = mimeType.isEmpty ? "application/octet-stream" : mimeType
    }
}

private enum ExportError: LocalizedError {
    case invalidDataUrl

    var errorDescription: String? {
        switch self {
        case .invalidDataUrl:
            return "文件数据格式不正确。"
        }
    }
}
