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

  var header = document.querySelector("body > header");
  if (!header || document.querySelector(".sexsi-pwa-install")) return;

  var installButton = document.createElement("button");
  installButton.type = "button";
  installButton.className = "sexsi-pwa-install";
  installButton.textContent = "ИНСТАЛИРАЙ";
  installButton.setAttribute("aria-label", "Инсталирай SEXSI TOURNAMENTS");

  var style = document.createElement("style");
  style.textContent =
    ".sexsi-pwa-install{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:10px 13px;border:1px solid #ed252d;border-radius:7px;background:#171012;color:#fff;font-size:10px;font-weight:900;letter-spacing:.6px;white-space:nowrap;cursor:pointer;transition:background .2s,border-color .2s,transform .2s}" +
    ".sexsi-pwa-install:hover{background:#ed252d;transform:translateY(-1px)}" +
    ".sexsi-pwa-install:focus-visible{outline:2px solid #fff;outline-offset:3px}" +
    "@media(max-width:650px){.sexsi-pwa-install{min-height:36px;padding:9px 10px;font-size:9px}}";
  document.head.appendChild(style);

  var navWrap = header.querySelector(".sexsi-global-nav");
  if (navWrap) {
    navWrap.insertBefore(installButton, navWrap.firstChild);
    navWrap.style.display = "flex";
    navWrap.style.alignItems = "center";
    navWrap.style.gap = "8px";
  } else {
    header.appendChild(installButton);
  }

  var deferredPrompt = null;
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  function showInstallHelp() {
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) {
      window.alert("За да добавиш SEXSI TOURNAMENTS на iPhone/iPad:\n\n1. Натисни бутона Споделяне в Safari.\n2. Избери „Добави към началния екран“.\n3. Потвърди с „Добави“.");
      return;
    }

    window.alert("Отвори менюто на браузъра (⋮) и избери „Инсталиране на приложението“ или „Добавяне към началния екран“. Ако опцията липсва, отвори сайта през Chrome и опитай отново.");
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    installButton.textContent = "ИНСТАЛИРАНО";
    installButton.disabled = true;
  });

  if (isStandalone) {
    installButton.textContent = "ИНСТАЛИРАНО";
    installButton.disabled = true;
  }

  installButton.addEventListener("click", async function () {
    if (isStandalone) return;

    if (!deferredPrompt) {
      showInstallHelp();
      return;
    }

    deferredPrompt.prompt();
    try {
      var choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        installButton.textContent = "ИНСТАЛИРАНО";
      }
    } catch (error) {
      console.warn("SEXSI PWA install prompt:", error);
    }
    deferredPrompt = null;
  });
})();
