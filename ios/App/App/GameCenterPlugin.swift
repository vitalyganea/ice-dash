import Foundation
import UIKit
import GameKit
import Capacitor

/* The Freeride board on Game Center and the save in iCloud, for
   js/native.js: the iPhone's side of what PlayGamesPlugin.java does on
   Android, with the same calls and the same answers, so native.js only has
   to know which of the two it has.

   The board's id is ICEDashLeaderboardFreeride in Info.plist, filled from
   ICEDASH_BOARD_FREERIDE in ios/ids.xcconfig; empty, there is no board and
   status() says so. Game Center signs the player in by itself as the app
   starts when the phone is signed in to it. When Apple wants the player to
   sign in, its sheet is kept and put up only when the board is opened
   (show(), top()), never over a run.

   The save goes to the iCloud key-value store (iCloud in the app's
   entitlements), which the phone keeps in step with the player's iCloud
   account: the game installed again, or a new phone, gets it back. iCloud
   itself throws away a write made before the phone's first copy from it
   has come, so a new phone never puts its empty save over a full one.

   What Apple says goes to the log under "IceDashBoard". */
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submit", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "top", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mine", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudLoad", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudSave", returnType: CAPPluginReturnPromise)
    ]
    /* the board panel shows places 1 to 100, which Game Center gives at once */
    private static let boardRows = 100
    /* the whole save, and how much is in it (runs and fish, from ui.js) */
    private static let cloudKey = "icedash-save"
    private static let progressKey = "icedash-progress"
    /* how long a first look at the cloud waits for iCloud's first copy */
    private static let cloudWait = 3.0

    private var board = ""
    private var signInView: UIViewController?
    private var signInWaiting: [(Bool) -> Void] = []
    private var shown: CAPPluginCall?

    override public func load() {
        board = (Bundle.main.object(forInfoDictionaryKey: "ICEDashLeaderboardFreeride") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        NSUbiquitousKeyValueStore.default.synchronize()
        if board.isEmpty { return }
        DispatchQueue.main.async {
            GKLocalPlayer.local.authenticateHandler = { [weak self] view, error in
                guard let self = self else { return }
                if let view = view { self.signInView = view }
                if let error = error { self.log("not signed in: \(error.localizedDescription)") }
                let inNow = GKLocalPlayer.local.isAuthenticated
                if inNow {
                    self.signInView = nil
                    /* native.js sends a best that could not go before */
                    self.notifyListeners("signedIn", data: [:])
                }
                /* a sheet that was put up and closed, either way */
                if view == nil {
                    let waiting = self.signInWaiting
                    self.signInWaiting = []
                    waiting.forEach { $0(inNow) }
                }
            }
        }
    }

    private func log(_ s: String) {
        CAPLog.print("IceDashBoard: \(s)")
    }

    /* done(signed in); with ask, Apple's sign-in sheet first if it has one waiting */
    private func signedIn(ask: Bool, _ done: @escaping (Bool) -> Void) {
        DispatchQueue.main.async {
            if GKLocalPlayer.local.isAuthenticated { done(true); return }
            guard ask, let view = self.signInView, let host = self.bridge?.viewController else { done(false); return }
            self.signInView = nil
            self.signInWaiting.append(done)
            host.present(view, animated: true)
        }
    }

    private static func number(_ call: CAPPluginCall, _ key: String) -> Int {
        return (call.options[key] as? NSNumber)?.intValue ?? 0
    }

    private func row(_ e: GKLeaderboard.Entry, _ me: Bool) -> [String: Any] {
        return ["rank": e.rank, "name": e.player.displayName, "score": e.score, "me": me]
    }

    /* { available: is there a board at all, signedIn: is the player in } */
    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["available": !self.board.isEmpty,
                          "signedIn": !self.board.isEmpty && GKLocalPlayer.local.isAuthenticated])
        }
    }

    /* { sent: whether the score went to the board }: not signed in, it did
       not, and native.js sends it again later. */
    @objc func submit(_ call: CAPPluginCall) {
        let score = GameCenterPlugin.number(call, "score")
        if board.isEmpty || score <= 0 {
            call.resolve(["sent": false])
            return
        }
        signedIn(ask: false) { ok in
            if !ok {
                self.log("score \(score) not sent: not signed in")
                call.resolve(["sent": false])
                return
            }
            GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [self.board]) { error in
                if let error = error {
                    self.log("score \(score) refused: \(error.localizedDescription)")
                    call.resolve(["sent": false, "error": error.localizedDescription])
                } else {
                    self.log("score \(score) taken")
                    call.resolve(["sent": true])
                }
            }
        }
    }

    /* The board for the game's own panel: { rows: the best 100 for the span
       ("day", "week" or "all"), each { rank, name, score, me }, me: the
       player's own row, which may be far below them, or absent }. */
    @objc func top(_ call: CAPPluginCall) {
        if board.isEmpty {
            call.reject("no board")
            return
        }
        let span = call.getString("span") ?? "all"
        let scope: GKLeaderboard.TimeScope = span == "day" ? .today : span == "week" ? .week : .allTime
        signedIn(ask: true) { ok in
            if !ok {
                call.reject("not signed in")
                return
            }
            GKLeaderboard.loadLeaderboards(IDs: [self.board]) { boards, error in
                guard let lb = boards?.first else {
                    self.log("board not loaded: \(error?.localizedDescription ?? "no such board")")
                    call.reject(error?.localizedDescription ?? "no board")
                    return
                }
                let range = NSRange(location: 1, length: GameCenterPlugin.boardRows)
                lb.loadEntries(for: .global, timeScope: scope, range: range) { mine, entries, _, error in
                    if let error = error, entries == nil {
                        self.log("board not loaded: \(error.localizedDescription)")
                        call.reject(error.localizedDescription)
                        return
                    }
                    let me = GKLocalPlayer.local.gamePlayerID
                    var r: [String: Any] = [:]
                    if let mine = mine { r["me"] = self.row(mine, true) }
                    r["rows"] = (entries ?? []).map { self.row($0, $0.player.gamePlayerID == me) }
                    call.resolve(r)
                }
            }
        }
    }

    /* The player's own place on the all-time board, for the best on the
       title: { rank, score }, or nothing when there is none yet (not signed
       in, no score, no network). It never asks the player to sign in. */
    @objc func mine(_ call: CAPPluginCall) {
        if board.isEmpty {
            call.resolve([:])
            return
        }
        signedIn(ask: false) { ok in
            if !ok {
                call.resolve([:])
                return
            }
            GKLeaderboard.loadLeaderboards(IDs: [self.board]) { boards, _ in
                guard let lb = boards?.first else {
                    call.resolve([:])
                    return
                }
                lb.loadEntries(for: [GKLocalPlayer.local], timeScope: .allTime) { mine, _, _ in
                    if let mine = mine, mine.rank > 0 {
                        call.resolve(["rank": mine.rank, "score": mine.score])
                    } else {
                        call.resolve([:])
                    }
                }
            }
        }
    }

    /* Apple's own board screen; resolves when the player comes back. */
    @objc func show(_ call: CAPPluginCall) {
        if board.isEmpty {
            call.reject("no board")
            return
        }
        signedIn(ask: true) { ok in
            guard ok, let host = self.bridge?.viewController else {
                call.reject("not signed in")
                return
            }
            let view = GKGameCenterViewController(leaderboardID: self.board, playerScope: .global, timeScope: .allTime)
            view.gameCenterDelegate = self
            self.shown = call
            host.present(view, animated: true)
        }
    }

    public func gameCenterViewControllerDidFinish(_ view: GKGameCenterViewController) {
        view.dismiss(animated: true) {
            self.shown?.resolve()
            self.shown = nil
        }
    }

    /* cloudLoad: { ok: the cloud answered, signedIn, data: the save's JSON
       or null when there is none yet }. Not signed in to iCloud, it did not
       answer, and nothing is written there. */
    @objc func cloudLoad(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let signedIn = FileManager.default.ubiquityIdentityToken != nil
            if !signedIn {
                call.resolve(["ok": false, "signedIn": false])
                return
            }
            let kv = NSUbiquitousKeyValueStore.default
            var over = false
            var watch: NSObjectProtocol?
            let answer = {
                if over { return }
                over = true
                if let w = watch { NotificationCenter.default.removeObserver(w) }
                var r: [String: Any] = ["ok": true, "signedIn": true]
                if let data = kv.string(forKey: GameCenterPlugin.cloudKey) { r["data"] = data }
                self.log("cloud save read: \((r["data"] as? String)?.count ?? 0) chars")
                call.resolve(r)
            }
            if kv.string(forKey: GameCenterPlugin.cloudKey) != nil {
                answer()
                return
            }
            /* Nothing here yet: on a new phone iCloud's first copy may still
               be on its way, and is waited for a moment. */
            watch = NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                                           object: kv, queue: .main) { _ in answer() }
            kv.synchronize()
            DispatchQueue.main.asyncAfter(deadline: .now() + GameCenterPlugin.cloudWait) { answer() }
        }
    }

    /* cloudSave({ data, progress }): { saved }. Of two saves that disagree
       (two phones) the one with more in it is kept, as Google keeps it. */
    @objc func cloudSave(_ call: CAPPluginCall) {
        guard let data = call.getString("data") else {
            call.resolve(["saved": false])
            return
        }
        let progress = Int64(GameCenterPlugin.number(call, "progress"))
        DispatchQueue.main.async {
            if FileManager.default.ubiquityIdentityToken == nil {
                call.resolve(["saved": false])
                return
            }
            let kv = NSUbiquitousKeyValueStore.default
            if kv.object(forKey: GameCenterPlugin.progressKey) != nil && kv.longLong(forKey: GameCenterPlugin.progressKey) > progress {
                self.log("cloud save kept: it has more than this one (\(progress))")
                call.resolve(["saved": false])
                return
            }
            kv.set(data, forKey: GameCenterPlugin.cloudKey)
            kv.set(progress, forKey: GameCenterPlugin.progressKey)
            kv.synchronize()
            call.resolve(["saved": true])
        }
    }
}
