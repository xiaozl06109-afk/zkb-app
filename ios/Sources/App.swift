import UIKit
import WebKit

// 极简 WKWebView 外壳：把打包进 App 的 web/ 目录跑起来，
// 并把状态存进 UserDefaults（file:// 下 localStorage 不可靠，所以走原生桥）。

private let stateKey = "zkb_state"

private func jsStringLiteral(_ s: String) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: [s]),
          let text = String(data: data, encoding: .utf8) else { return "\"\"" }
    // ["..."] -> "..."
    return String(text.dropFirst().dropLast())
}

final class StoreBridge: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController,
                              didReceive message: WKScriptMessage) {
        guard message.name == "store", let body = message.body as? String else { return }
        if body.isEmpty {
            UserDefaults.standard.removeObject(forKey: stateKey)
        } else {
            UserDefaults.standard.set(body, forKey: stateKey)
        }
    }
}

final class RootViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var webView: WKWebView!
    private let bridge = StoreBridge()

    override var preferredStatusBarStyle: UIStatusBarStyle {
        traitCollection.userInterfaceStyle == .dark ? .lightContent : .darkContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor { tc in
            tc.userInterfaceStyle == .dark
                ? UIColor(red: 0.051, green: 0.067, blue: 0.09, alpha: 1)
                : UIColor(red: 0.961, green: 0.965, blue: 0.973, alpha: 1)
        }

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let ucc = WKUserContentController()
        ucc.add(bridge, name: "store")

        // 启动时把上次的存档注入，再交给页面初始化
        let saved = UserDefaults.standard.string(forKey: stateKey) ?? ""
        var inject = "window.__NATIVE_STATE__ = \(jsStringLiteral(saved));"
        inject += "window.__IS_NATIVE_APP__ = true;"
        ucc.addUserScript(WKUserScript(source: inject,
                                       injectionTime: .atDocumentStart,
                                       forMainFrameOnly: true))
        config.userContentController = ucc

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view.addSubview(webView)

        loadApp()
    }

    private func loadApp() {
        let bundle = Bundle.main
        // 资源被当作文件夹引用打包：ShengBen.app/web/index.html
        if let url = bundle.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else if let url = bundle.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: bundle.bundleURL)
        } else {
            let html = "<h3 style='font-family:-apple-system;padding:24px'>资源缺失：web/index.html 未打包进 App</h3>"
            webView.loadHTMLString(html, baseURL: nil)
        }
    }

    // 外部链接交给系统浏览器，避免 App 内跳到无关页面
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url,
           navigationAction.navigationType == .linkActivated,
           let scheme = url.scheme?.lowercased(),
           scheme == "http" || scheme == "https" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let win = UIWindow(frame: UIScreen.main.bounds)
        win.rootViewController = RootViewController()
        win.makeKeyAndVisible()
        window = win
        return true
    }
}
