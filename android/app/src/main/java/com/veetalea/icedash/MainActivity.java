package com.veetalea.icedash;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* The app's own plugin (not from npm) has to be named before the
           bridge starts. */
        registerPlugin(PlayGamesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
