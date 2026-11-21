(function () {
  "use strict";

  // Премахва старото PWA поведение и кеша на SEXSI TOURNAMENTS.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) {
        var scriptUrl = registration.active && registration.active.scriptURL ||
          registration.waiting && registration.waiting.scriptURL ||
          registration.installing && registration.installing.scriptURL || "";
        if (scriptUrl.indexOf("/sw.js") !== -1 &&
            registration.scope.indexOf("/sexsi-tournaments/") !== -1) {
          registration.unregister();
        }
      });
    }).catch(function (error) {
      console.warn("SEXSI PWA cleanup registration check failed:", error);
    });
  }

  if ("caches" in window) {
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf("sexsi-pwa-") === 0;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).catch(function (error) {
      console.warn("SEXSI PWA cache cleanup failed:", error);
    });
  }
})();