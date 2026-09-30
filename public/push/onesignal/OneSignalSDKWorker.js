// OneSignal's push service worker. It lives under /push/onesignal/ with that
// as its scope so it never competes with WorkLedger's own /sw.js (offline
// shell) for the root scope -- push delivery doesn't depend on scope.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
