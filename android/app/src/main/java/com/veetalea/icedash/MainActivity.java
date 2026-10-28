package com.veetalea.icedash;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;

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
    }
}
