package com.veetalea.icedash;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.games.AuthenticationResult;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.tasks.Task;

/* The Freeride board on Google Play Games, for js/native.js.

   The game's Play Games project id and the board's id are in
   res/values/play-ids.xml. While either is empty the SDK is never started
   and status() says there is no board, so the app runs as it did without
   one. Play Games v2 signs the player in by itself when the app starts;
   show() asks once more if that did not happen. */
@CapacitorPlugin(name = "PlayGames")
public class PlayGamesPlugin extends Plugin {
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
        Long score = call.getLong("score");
        JSObject r = new JSObject();
        if (board.isEmpty() || score == null || score <= 0) {
            r.put("sent", false);
            call.resolve(r);
            return;
        }
        signIn().isAuthenticated().addOnCompleteListener(t -> {
            boolean ok = in(t);
            if (ok) PlayGames.getLeaderboardsClient(getActivity()).submitScore(board, score);
            r.put("sent", ok);
            call.resolve(r);
        });
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
