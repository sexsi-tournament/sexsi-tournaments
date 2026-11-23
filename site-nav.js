(function(){
  "use strict";
  if(document.body.dataset.siteNavReady==="true") return;
  document.body.dataset.siteNavReady="true";

  var header=document.querySelector("body > header");
  if(!header){
    header=document.createElement("header");
    var main=document.querySelector("main");
    if(main) document.body.insertBefore(header,main);
    else document.body.insertBefore(header,document.body.firstChild);
  }

  var logo=header.querySelector(".logo, a[aria-label*='начал'], a[href='index.html']");
  var preservedActions=header.querySelector(".header-actions");
  if(!logo){
    logo=document.createElement("a");
    logo.className="logo";
    logo.href="index.html";
    logo.textContent="SEXSI";
  }
  if(preservedActions) preservedActions.remove();

  Array.from(header.children).forEach(function(child){
    if(child!==logo) child.remove();
  });
  if(logo.parentElement!==header) header.insertBefore(logo,header.firstChild);

  var wrap=document.createElement("div");
  wrap.className="sexsi-global-nav";
  var toggle=document.createElement("button");
  toggle.type="button";
  toggle.className="sexsi-global-nav-toggle";
  toggle.setAttribute("aria-expanded","false");
  toggle.setAttribute("aria-controls","sexsiGlobalMenu");
  toggle.textContent="☰ МЕНЮ";
  var panel=document.createElement("div");
  panel.className="sexsi-global-nav-panel";
  panel.id="sexsiGlobalMenu";
  panel.hidden=true;

  var links=[
    ["index.html","НАЧАЛО"],
    ["tournaments.html","ТУРНИРИ"],
    ["community.html","BG COMMUNITY"],
    ["tournament-001.html","АКТИВЕН ТУРНИР"],
    ["matches.html","МОИТЕ ДВУБОИ"],
    ["bracket.html","ТУРНИРНА СХЕМА"],
    ["messages.html","ЛИЧНИ СЪОБЩЕНИЯ"],
    ["news.html","НОВИНИ"],
    ["recruitment.html","КАРИЕРИ В SEXSI"],
    ["ranking.html","КЛАСАЦИЯ"],
    ["archive.html","АРХИВ"],
    ["profile.html","МОЯТ ПРОФИЛ"],
    ["privacy.html","ПОВЕРИТЕЛНОСТ"]
  ];
  var nav=document.createElement("nav");
  nav.setAttribute("aria-label","Основна навигация");
  links.forEach(function(item){
    var a=document.createElement("a");
    a.href=item[0];
    a.textContent=item[1];
    if(location.pathname.endsWith("/"+item[0]) || (item[0]==="index.html" && /\/$/.test(location.pathname))){
      a.setAttribute("aria-current","page");
    }
    nav.appendChild(a);
  });

  var adminLink=document.createElement("a");
  adminLink.href="admin.html";
  adminLink.className="sexsi-admin-nav-link";
  adminLink.textContent="🛡 АДМИНИСТРАТИВЕН ПАНЕЛ";
  adminLink.hidden=true;
  nav.appendChild(adminLink);\n\n  var recruitmentAdminLink=document.createElement("a");\n  recruitmentAdminLink.href="recruitment-admin.html";\n  recruitmentAdminLink.className="sexsi-admin-nav-link";\n  recruitmentAdminLink.textContent="📋 RECRUITMENT CONTROL";\n  recruitmentAdminLink.hidden=true;\n  nav.appendChild(recruitmentAdminLink);
  panel.appendChild(nav);
  if(preservedActions) panel.appendChild(preservedActions);
  wrap.appendChild(toggle);
  wrap.appendChild(panel);
  header.appendChild(wrap);

  var style=document.createElement("style");
  style.textContent=
    "body>header{position:relative;z-index:1000;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 6%;background:#080809;border-bottom:1px solid #292929;}" +
    ".sexsi-global-nav{position:relative;margin-left:auto;}" +
    ".sexsi-global-nav-toggle{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 15px;border:1px solid #ed252d;border-radius:7px;background:#ed252d;color:#fff;font-weight:900;font-size:11px;letter-spacing:.6px;cursor:pointer;}" +
    ".sexsi-global-nav-panel{position:absolute;right:0;top:calc(100% + 10px);width:min(290px,calc(100vw - 32px));max-height:min(75vh,560px);overflow:auto;padding:10px;background:#111;border:1px solid #393939;border-radius:12px;box-shadow:0 16px 40px #000b;z-index:2000;}" +
    ".sexsi-global-nav-panel[hidden]{display:none!important;}" +
    ".sexsi-global-nav-panel nav{display:flex;flex-direction:column;gap:5px;margin:0;}" +
    ".sexsi-global-nav-panel nav a{display:block;margin:0;padding:12px 13px;border-radius:7px;background:#191919;color:#eee;text-decoration:none;font-size:11px;font-weight:800;letter-spacing:.3px;}" +
    ".sexsi-global-nav-panel nav a[aria-current=page]{background:#321719;color:#ff777c;border-left:3px solid #ed252d;}" +
    ".sexsi-global-nav-panel nav a.sexsi-admin-nav-link{margin-top:7px;border:1px solid rgba(237,37,45,.65);background:linear-gradient(110deg,#351014,#1a0b0d);color:#ff777c;font-weight:1000;}" +
    ".sexsi-global-nav-panel nav a.sexsi-admin-nav-link[hidden]{display:none!important;}" +
    ".sexsi-global-nav-panel .header-actions{display:flex;flex-direction:column;gap:6px;margin-top:8px;}" +
    ".sexsi-global-nav-panel .header-actions>*{width:100%;margin:0;}" +
    "@media(max-width:650px){body>header{flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;}.sexsi-global-nav-toggle{padding:10px 12px;}}";
  document.head.appendChild(style);

  toggle.addEventListener("click",function(){
    var open=panel.hidden;
    panel.hidden=!open;
    toggle.setAttribute("aria-expanded",String(open));
  });
  document.addEventListener("click",function(event){
    if(!wrap.contains(event.target)){
      panel.hidden=true;
      toggle.setAttribute("aria-expanded","false");
    }
  });
  document.addEventListener("keydown",function(event){
    if(event.key==="Escape"){
      panel.hidden=true;
      toggle.setAttribute("aria-expanded","false");
    }
  });

  // Покажи административната връзка само след проверка на реалните права в Supabase.
  var SUPABASE_URL="https://fyxlwcoochsuzhqostpe.supabase.co";
  var SUPABASE_KEY="sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";
  var accessClient=null;
  var accessCheckSequence=0;
  function updateAdminLink(session){
    var sequence=++accessCheckSequence;
    adminLink.hidden=true;
    if(!session || !session.user) return;
    if(!accessClient) return;
    accessClient.rpc("sexsi_admin_get_access").then(function(result){
      if(sequence!==accessCheckSequence) return;
      if(result.error){
        console.error("Admin navigation permission check failed:",result.error);
        return;
      }
      adminLink.hidden=!result.data?.authorized;\n      recruitmentAdminLink.hidden=!(result.data?.authorized && Array.isArray(result.data?.permissions) && result.data.permissions.includes("manage_recruitment"));
    }).catch(function(error){
      console.error("Admin navigation permission check failed:",error);
    });
  }
  function initializeAdminLink(){
    if(!window.supabase || !window.supabase.createClient) return;
    accessClient=window.sexsiSupabase || window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    accessClient.auth.getSession().then(function(result){
      if(!result.error) updateAdminLink(result.data.session);
    }).catch(function(error){console.error("Admin navigation session error:",error);});
    accessClient.auth.onAuthStateChange(function(event,session){updateAdminLink(session);});
  }
  initializeAdminLink();

  var pwaCleanup=document.createElement("script");
  pwaCleanup.src="pwa.js?v=3";
  pwaCleanup.defer=true;
  document.body.appendChild(pwaCleanup);
})();