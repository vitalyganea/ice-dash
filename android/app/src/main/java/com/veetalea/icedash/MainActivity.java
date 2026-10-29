package com.veetalea.icedash;

import android.graphics.Rect;
import android.os.Bundle;
import android.view.View;

import androidx.activity.EdgeToEdge;
import androidx.core.view.ViewCompat;

import java.util.Arrays;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* The app's own plugin (not from npm) has to be named before the
           bridge starts. */
        registerPlugin(PlayGamesPlugin.class);
        /* Edge to edge on every Android, not only from 15 on, where it is
           the rule: Capacitor's SystemBars hands the bars' room to the page
           (env(safe-area-inset-*)) either way. */
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        /* The back arrow sits in the bottom-left corner and the pause button
           in the bottom-right; with gesture navigation the sides are where
           Android listens for its own back swipe, and a tap on the arrow now
           and then went to it. Those two corners are kept for the game. */
        View root = getWindow().getDecorView();
        root.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> {
            int w = r - l, h = b - t;
            int side = Math.round(120 * getResources().getDisplayMetrics().density);
            ViewCompat.setSystemGestureExclusionRects(v, Arrays.asList(
                new Rect(0, h - side, side, h), new Rect(w - side, h - side, w, h)));
        });
    }
}
