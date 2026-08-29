/** Stale index-BYDtnCzP.js — one-shot SW nuke. Never location.replace in a loop. */
(async function () {
  var KEY = "grudge_bydtn_nuked";
  try {
    if (sessionStorage.getItem(KEY) === "1") {
      document.open();
      document.write(
        '<!doctype html><meta charset="utf-8"><title>Open shell</title>' +
          "<body style=\"margin:0;background:#171a21;color:#c7d5e0;font:16px/1.4 system-ui;padding:48px\">" +
          "<p>Old Open shell was blocked (index-BYDtnCzP.js).</p>" +
          "<p>Close this tab. Open a new one:</p>" +
          '<p><a href="https://open.grudge-studio.com/combat?nosw=1" style="color:#66c0f4">open.grudge-studio.com/combat?nosw=1</a></p>'
      );
      document.close();
      return;
    }
    sessionStorage.setItem(KEY, "1");
  } catch (_) {}

  try {
    if ("serviceWorker" in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      for (var i = 0; i < regs.length; i++) {
        try {
          if (regs[i].active) regs[i].active.postMessage({ type: "NUKE" });
        } catch (_) {}
        await regs[i].unregister();
      }
    }
    if ("caches" in window) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }
    try {
      localStorage.setItem("grudge_open_shell_cache_ver", "6");
    } catch (_) {}
  } catch (_) {}
})();
