// Verityio's single root service worker: OneSignal push delivery plus the
// offline app shell (sw.js). It lives at the site root because that's where
// OneSignal's dashboard ("Typical Site") setup looks for it, and one worker
// at "/" avoids two workers competing for the same scope -- which iPhone
// home-screen apps in particular don't handle.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
importScripts("/sw.js");
