package com.veetalea.icedash;

import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.LeaderboardsClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;
import com.google.android.gms.tasks.Task;

/* The Freeride board on Google Play Games, for js/native.js.

   The game's Play Games project id and the board's id are in
   res/values/play-ids.xml. While either is empty the SDK is never started
   and status() says there is no board, so the app runs as it did without
   one. Play Games v2 signs the player in by itself when the app starts;
   show() and top() ask once more if that did not happen.

   What Google says to a score goes to the log under "IceDashBoard"
   (adb logcat -s IceDashBoard): in 1.2.0 the board stayed empty with
   nothing to say why, because the score was handed over and forgotten. */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {
    private static final String TAG = "IceDashBoard";
    private String board = "";

    @Override
    public void load() {
        String project = getContext().getString(R.string.game_services_project_id).trim();
        String id = getContext().getString(R.string.leaderboard_freeride).trim();
        if (project.isEmpty() || id.isEmpty()) return;
        board = id;
        PlayGamesSdk.initialize(getContext());
    }

    private GamesSignInClient signIn() {
        return PlayGames.getGamesSignInClient(getActivity());
    }

    private static boolean in(Task<AuthenticationResult> t) {
        return t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated();
    }

    /* { available: is there a board at all, signedIn: is the player in } */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", !board.isEmpty());
        if (board.isEmpty()) {
            r.put("signedIn", false);
            call.resolve(r);
            return;
        }
        signIn().isAuthenticated().addOnCompleteListener(t -> {
            r.put("signedIn", in(t));
            call.resolve(r);
        });
    }

    /* { sent: whether the score went to the board } — not signed in, it
       did not, and native.js sends it again later. */
    @PluginMethod
    public void submit(PluginCall call) {
        /* Not call.getLong: Capacitor gives a value back only when the number
           arrived as a Long, and a score from the page arrives as an Integer
           (17477 fits in one), so getLong said null, the score was taken for
           missing, and up to 1.2.1 no score ever reached the board. */
        long score = call.getData().optLong("score", 0);
        JSObject r = new JSObject();
        if (board.isEmpty() || score <= 0) {
            Log.i(TAG, "score not sent: " + (board.isEmpty() ? "no board" : "no score (" + call.getData().opt("score") + ")"));
            r.put("sent", false);
            call.resolve(r);
            return;
        }
        signIn().isAuthenticated().addOnCompleteListener(t -> {
            if (!in(t)) {
                Log.i(TAG, "score " + score + " not sent: not signed in");
                r.put("sent", false);
                call.resolve(r);
                return;
            }
            PlayGames.getLeaderboardsClient(getActivity()).submitScoreImmediate(board, score)
                .addOnSuccessListener(d -> {
                    Log.i(TAG, "score " + score + " taken: " + d);
                    r.put("sent", true);
                    call.resolve(r);
                })
                .addOnFailureListener(e -> {
                    Log.w(TAG, "score " + score + " refused: " + e);
                    r.put("sent", false);
                    r.put("error", String.valueOf(e.getMessage()));
                    call.resolve(r);
                });
        });
    }

    /* The board for the game's own panel: { rows: the best 25 for the span
       ("day", "week" or "all"), each { rank, name, score, me }, me: the
       player's own row, which may be far below them, or absent }. */
    @PluginMethod
    public void top(PluginCall call) {
        if (board.isEmpty()) {
            call.reject("no board");
            return;
        }
        String s = call.getString("span", "all");
        int span = "day".equals(s) ? LeaderboardVariant.TIME_SPAN_DAILY
                 : "week".equals(s) ? LeaderboardVariant.TIME_SPAN_WEEKLY
                 : LeaderboardVariant.TIME_SPAN_ALL_TIME;
        int everyone = LeaderboardVariant.COLLECTION_PUBLIC;
        signIn().isAuthenticated()
            .continueWithTask(t -> in(t) ? t : signIn().signIn())
            .addOnCompleteListener(t -> {
                if (!in(t)) {
                    call.reject("not signed in");
                    return;
                }
                LeaderboardsClient lb = PlayGames.getLeaderboardsClient(getActivity());
                lb.loadCurrentPlayerLeaderboardScore(board, span, everyone).addOnCompleteListener(m -> {
                    JSObject r = new JSObject();
                    LeaderboardScore mine = m.isSuccessful() && m.getResult() != null ? m.getResult().get() : null;
                    String myId = null;
                    if (mine != null) {
                        r.put("me", row(mine, true));
                        if (mine.getScoreHolder() != null) myId = mine.getScoreHolder().getPlayerId();
                    }
                    final String me = myId;
                    lb.loadTopScores(board, span, everyone, 25, true)
                        .addOnSuccessListener(d -> {
                            JSArray rows = new JSArray();
                            LeaderboardsClient.LeaderboardScores got = d.get();
                            if (got != null) {
                                try {
                                    for (LeaderboardScore x : got.getScores()) {
                                        String id = x.getScoreHolder() != null ? x.getScoreHolder().getPlayerId() : null;
                                        rows.put(row(x, me != null && me.equals(id)));
                                    }
                                } finally {
                                    got.release();
                                }
                            }
                            r.put("rows", rows);
                            call.resolve(r);
                        })
                        .addOnFailureListener(e -> {
                            Log.w(TAG, "board not loaded: " + e);
                            call.reject(String.valueOf(e.getMessage()));
                        });
                });
            });
    }

    private static JSObject row(LeaderboardScore s, boolean me) {
        JSObject o = new JSObject();
        o.put("rank", s.getRank());
        o.put("name", s.getScoreHolderDisplayName());
        o.put("score", s.getRawScore());
        o.put("me", me);
        return o;
    }

    /* Google's own board screen; resolves when the player comes back. */
    @PluginMethod
    public void show(PluginCall call) {
        if (board.isEmpty()) {
            call.reject("no board");
            return;
        }
        signIn().isAuthenticated()
            .continueWithTask(t -> in(t) ? t : signIn().signIn())
            .addOnCompleteListener(t -> {
                if (!in(t)) {
                    call.reject("not signed in");
                    return;
                }
                PlayGames.getLeaderboardsClient(getActivity())
                    .getLeaderboardIntent(board)
                    .addOnSuccessListener(intent -> startActivityForResult(call, intent, "shown"))
                    .addOnFailureListener(e -> call.reject(e.getMessage()));
            });
    }

    @ActivityCallback
    private void shown(PluginCall call, ActivityResult result) {
        if (call != null) call.resolve();
    }
}
