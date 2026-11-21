(function () {
  "use strict";

  var currentScript = document.currentScript;
  var scriptUrl = currentScript && currentScript.src
    ? new URL(currentScript.src)
    : new URL("./pwa.js", window.location.href);
  var baseUrl = new URL("./", scriptUrl);

  if (!document.querySelector('link[rel="manifest"]')) {
    var manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = new URL("manifest.webmanifest", baseUrl).href;
    document.head.appendChild(manifest);
  }

  if (!document.querySelector('link[rel="icon"]')) {
    var favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.href = new URL("pwa-icon.svg", baseUrl).href;
    document.head.appendChild(favicon);
  }

  [
    ["apple-mobile-web-app-capable", "yes"],
    ["apple-mobile-web-app-title", "SEXSI TOURNAMENTS"],
    ["apple-mobile-web-app-status-bar-style", "black-translucent"]
  ].forEach(function (entry) {
    if (!document.querySelector('meta[name="' + entry[0] + '"]')) {
      var meta = document.createElement("meta");
      meta.name = entry[0];
      meta.content = entry[1];
      document.head.appendChild(meta);
    }
  });

  if (!document.querySelector('meta[name="theme-color"]')) {
    var theme = document.createElement("meta");
    theme.name = "theme-color";
    theme.content = "#080808";
    document.head.appendChild(theme);
  }

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(new URL("sw.js", baseUrl).href, {
        scope: baseUrl.pathname
      }).catch(function (error) {
        console.error("SEXSI PWA service worker registration failed:", error);
      });
    }, { once: true });
  }

})();
