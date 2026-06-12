import SwiftUI

@main
struct PixelToyDesignerApp: App {
    var body: some Scene {
        WindowGroup {
            WebViewContainer()
                .ignoresSafeArea()
        }
    }
}
