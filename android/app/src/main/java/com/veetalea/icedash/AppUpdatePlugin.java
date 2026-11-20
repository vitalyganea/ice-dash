package com.veetalea.icedash;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/* Google Play's own update from inside the app (In-App Updates), asked for
   by the owner, 20 Nov 2026: many players stay several versions behind.
   check() says whether Play has a newer build for this phone; start() puts
   up Play's full-screen update, which downloads, installs and restarts the
   game with one tap of the player's. Play decides; a phone the rollout has
   not reached yet, or an app not installed from Play (the debug build, an
   emulator without the Play Store), hears "none" and the game's own
   banner sends the player to the store page instead (js/native.js). */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String TAG = "IceDashUpdate";
    private static final int REQUEST = 4217;
    private AppUpdateManager manager;
    private AppUpdateInfo last;

    @Override
    public void load() {
        manager = AppUpdateManagerFactory.create(getContext());
    }

    /* { answered, available, versionCode, immediate, inProgress }; answered false when Play could not be asked */
    @PluginMethod
    public void check(PluginCall call) {
        JSObject r = new JSObject();
        manager.getAppUpdateInfo().addOnCompleteListener(t -> {
            if (!t.isSuccessful() || t.getResult() == null) {
                Log.i(TAG, "no answer from Play: " + t.getException());
                r.put("available", false);
                call.resolve(r);
                return;
            }
            AppUpdateInfo info = last = t.getResult();
            r.put("answered", true);
            int a = info.updateAvailability();
            r.put("available", a == UpdateAvailability.UPDATE_AVAILABLE);
            r.put("inProgress", a == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS);
            r.put("versionCode", info.availableVersionCode());
            r.put("immediate", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
            Log.i(TAG, "Play says: availability " + a + ", version " + info.availableVersionCode());
            call.resolve(r);
        });
    }

    /* { started }: Play's update screen is up (or it could not be) */
    @PluginMethod
    public void start(PluginCall call) {
        JSObject r = new JSObject();
        AppUpdateInfo info = last;
        if (info == null || getActivity() == null) {
            r.put("started", false);
            call.resolve(r);
            return;
        }
        try {
            boolean ok = manager.startUpdateFlowForResult(info, getActivity(),
                AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(), REQUEST);
            r.put("started", ok);
        } catch (Exception e) {
            Log.w(TAG, "update not started: " + e);
            r.put("started", false);
        }
        call.resolve(r);
    }
}
