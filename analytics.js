(function () {
  "use strict";

  const SUPABASE_URL = "https://fyxlwcoochsuzhqostpe.supabase.co";
  const SUPABASE_KEY = "sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";
  const CONSENT_KEY = "sexsi_analytics_consent";
  const VISITOR_KEY = "sexsi_visitor_id";
  let heartbeatTimer = null;

  function createBanner() {
    if (document.getElementById("sexsiAnalyticsConsent")) return;
    const banner = document.createElement("aside");
    banner.id = "sexsiAnalyticsConsent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Настройки за статистика");
    banner.style.cssText = "position:fixed;z-index:100000;left:16px;right:16px;bottom:16px;max-width:760px;margin:auto;padding:16px;background:#141416;color:#fff;border:1px solid #633034;border-radius:10px;box-shadow:0 12px 40px #000b;font:13px/1.55 Arial,sans-serif";
    banner.innerHTML = '<div style="font-weight:800;margin-bottom:5px">Статистика на посещенията</div><div style="color:#bbb">Използваме анонимен идентификатор, за да броим посещенията и активността по страниците. Статистиката не е необходима за работата на сайта и се включва само с твоето съгласие. <a href="privacy.html" style="color:#ff777c">Поверителност</a>.</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" data-consent="yes" style="background:#ed252d;color:white;border:0;border-radius:5px;padding:10px 14px;font-weight:800">ПРИЕМАМ</button><button type="button" data-consent="no" style="background:#252528;color:#ddd;border:1px solid #555;border-radius:5px;padding:10px 14px;font-weight:800">ОТКАЗВАМ</button></div>';
    banner.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-consent]");
      if (!button) return;
      try { localStorage.setItem(CONSENT_KEY, button.dataset.consent === "yes" ? "accepted" : "rejected"); } catch (_) {}
      banner.remove();
      if (button.dataset.consent === "yes") startTracking();
    });
    document.body.appendChild(banner);
  }

  function getVisitorId() {
    try {
      let id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = window.crypto && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
              const r = Math.random() * 16 | 0;
              return (c === "x" ? r : (r & 3 | 8)).toString(16);
            });
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (error) {
      console.warn("Analytics storage unavailable:", error);
      return null;
    }
  }

  function startTracking() {
    if (heartbeatTimer) return;
    function startWithClient() {
      if (!window.supabase || !window.supabase.createClient) return;
      const db = window.sexsiSupabase || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      const visitorId = getVisitorId();
      if (!visitorId) return;
      const page = (location.pathname.split("/").pop() || "/").slice(0, 100);
      const visit = () => db.rpc("sexsi_track_visit", { p_visitor_id: visitorId, p_page: page })
        .then(({ error }) => { if (error) console.warn("Visit tracking failed:", error.message); });
      const heartbeat = () => db.rpc("sexsi_track_heartbeat", { p_visitor_id: visitorId })
        .then(({ error }) => { if (error) console.warn("Heartbeat failed:", error.message); });
      visit();
      heartbeat();
      heartbeatTimer = window.setInterval(heartbeat, 60000);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) heartbeat();
      });
    }

    if (window.supabase && window.supabase.createClient) {
      startWithClient();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = startWithClient;
    script.onerror = function () { console.warn("Analytics could not load Supabase."); };
    document.head.appendChild(script);
  }

  let consent = null;
  try { consent = localStorage.getItem(CONSENT_KEY); } catch (_) {}
  if (consent === "accepted") startTracking();
  else if (consent !== "rejected") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createBanner, { once: true });
    else createBanner();
  }
})();