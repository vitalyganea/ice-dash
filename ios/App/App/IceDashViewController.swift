import UIKit
import WebKit
import Capacitor

/* Capacitor's own view of the page, with what the game adds to it. */
class IceDashViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        /* The app's own plugin (not from npm) is named before the page loads. */
        bridge?.registerPluginInstance(GameCenterPlugin())
        #if DEBUG
        /* The simulator check on GitHub (.github/workflows/ios.yml) hands in
           a script at launch (ICEDASH_CHECK, made by test/ios-check.js) that
           walks the page through its screens. Debug builds only: the App
           Store build has no such door. */
        if let js = ProcessInfo.processInfo.environment["ICEDASH_CHECK"], !js.isEmpty {
            /* line by line, so the workflow reads each "ICEDASH-SHOT" as it is
               written (block by block, every picture came at the end) */
            setvbuf(stdout, nil, _IOLBF, 0)
            webView?.configuration.userContentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        #endif
    }

    /* The hill is the screen: no clock and battery over it, ever. Capacitor's
       SystemBars shows the bar as it loads (its "hidden" setting would hide
       Android's navigation bar too), and native.js hid it only once the page
       had loaded, so the first seconds had it (seen on the simulators). */
    override var prefersStatusBarHidden: Bool {
        return true
    }

    /* The pause button and the back arrow sit in the bottom corners, where
       the swipe home starts: a first swipe there is the game's, the second
       goes home (Android keeps the same corners, MainActivity.java). */
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return .bottom
    }
}
