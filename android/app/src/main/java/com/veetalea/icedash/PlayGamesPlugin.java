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
import com.google.android.gms.games.PageDirection;
import com.google.android.gms.games.leaderboard.LeaderboardScore;
import com.google.android.gms.games.leaderboard.LeaderboardScoreBuffer;
import com.google.android.gms.games.leaderboard.LeaderboardVariant;
import com.google.android.gms.tasks.Task;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
    /* the board panel shows places 1 to 100; Google gives 25 rows a time */
    private static final int BOARD_ROWS = 100, PAGE = 25;
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

    /* The board for the game's own panel: { rows: the best 100 for the span
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
                    lb.loadTopScores(board, span, everyone, PAGE, true)
                        .addOnSuccessListener(d -> more(lb, d.get(), new LinkedHashMap<>(), new ArrayList<>(), me, r, call))
                        .addOnFailureListener(e -> {
                            Log.w(TAG, "board not loaded: " + e);
                            call.reject(String.valueOf(e.getMessage()));
                        });
                });
            });
    }

    /* One page read, the next asked for with the buffer so far, until there
       are 100 rows or a page brings no one new. Rows are kept by player, so
       a page that repeats the ones before it adds nothing twice. */
    private void more(LeaderboardsClient lb, LeaderboardsClient.LeaderboardScores got, Map<String, JSObject> seen,
                      List<LeaderboardsClient.LeaderboardScores> held, String me, JSObject r, PluginCall call) {
        LeaderboardScoreBuffer buf = got != null ? got.getScores() : null;
        int added = 0;
        if (got != null) {
            held.add(got);
            for (LeaderboardScore x : buf) {
                String id = x.getScoreHolder() != null ? x.getScoreHolder().getPlayerId() : x.getScoreHolderDisplayName() + "#" + x.getRank();
                if (!seen.containsKey(id)) {
                    seen.put(id, row(x, me != null && me.equals(id)));
                    added++;
                }
            }
        }
        if (buf == null || added == 0 || seen.size() >= BOARD_ROWS) {
            finish(seen, held, r, call);
            return;
        }
        lb.loadMoreScores(buf, PAGE, PageDirection.NEXT).addOnCompleteListener(t -> {
            if (t.isSuccessful() && t.getResult() != null) {
                more(lb, t.getResult().get(), seen, held, me, r, call);
            } else {
                Log.w(TAG, "more rows not loaded: " + t.getException());
                finish(seen, held, r, call);
            }
        });
    }

    private static void finish(Map<String, JSObject> seen, List<LeaderboardsClient.LeaderboardScores> held,
                               JSObject r, PluginCall call) {
        List<JSObject> list = new ArrayList<>(seen.values());
        list.sort((a, b) -> Long.compare(a.optLong("rank"), b.optLong("rank")));
        JSArray rows = new JSArray();
        for (int i = 0; i < Math.min(BOARD_ROWS, list.size()); i++) rows.put(list.get(i));
        for (LeaderboardsClient.LeaderboardScores h : held) h.release();
        r.put("rows", rows);
        call.resolve(r);
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
