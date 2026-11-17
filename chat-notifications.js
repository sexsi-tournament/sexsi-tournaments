(function(){
  "use strict";
  const URL="https://fyxlwcoochsuzhqostpe.supabase.co";
  const KEY="sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";
  if(!window.supabase||!window.supabase.createClient)return;
  const db=window.sexsiSupabase||window.supabase.createClient(URL,KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
  let userId=null,unreadTotal=0,channel=null;
  const style=document.createElement("style");
  style.textContent="#sexsiChatNotice{position:fixed;right:17px;top:88px;z-index:99990}#sexsiChatNotice a{position:relative;width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:#171719;border:1px solid #45454b;color:#fff;text-decoration:none;font:18px Arial;box-shadow:0 5px 18px #0008}#sexsiChatNotice a:hover{border-color:#ed252d}#sexsiChatCount{position:absolute;right:-5px;top:-5px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;border-radius:20px;background:#ed252d;color:#fff;font:900 9px Arial;border:2px solid #09090b}#sexsiChatCount[hidden]{display:none!important}#sexsiChatToast{position:fixed;right:17px;top:139px;z-index:99991;max-width:min(330px,calc(100vw - 34px));padding:12px 14px;background:#211012;border:1px solid #ed252d;border-radius:9px;color:#fff;font:12px/1.5 Arial;box-shadow:0 8px 30px #0009;cursor:pointer}#sexsiChatToast[hidden]{display:none}";
  document.head.appendChild(style);
  const bar=document.createElement("div");bar.id="sexsiChatNotice";bar.style.display="none";
  bar.innerHTML='<a href="messages.html" aria-label="Съобщения" title="Съобщения">✉<span id="sexsiChatCount" hidden>0</span></a>';
  document.body.appendChild(bar);
  const countEl=document.getElementById("sexsiChatCount");
  const toast=document.createElement("div");toast.id="sexsiChatToast";toast.hidden=true;document.body.appendChild(toast);
  function updateCount(n){unreadTotal=n;countEl.textContent=n>99?"99+":String(n);countEl.hidden=n===0;}
  function showToast(text){toast.textContent=text;toast.hidden=false;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.hidden=true,5000);}
  async function refresh(silent){
    if(!userId)return;
    const {data,error}=await db.rpc("sexsi_chat_list");
    if(error){console.warn("SEXSI chat notifications:",error.message);return;}
    const rows=Array.isArray(data)?data:[],total=rows.reduce((sum,row)=>sum+Number(row.unread_count||0),0);
    if(!silent&&total>unreadTotal){
      const latest=rows.find(row=>Number(row.unread_count||0)>0),who=latest?.other_username||"Играч";
      showToast("Ново съобщение от "+who+". Натисни, за да отвориш чата.");
      toast.onclick=()=>location.href="messages.html";
      if(document.hidden&&"Notification" in window&&Notification.permission==="granted"){
        try{new Notification("SEXSI TOURNAMENTS",{body:"Ново съобщение от "+who,tag:"sexsi-chat"}).onclick=()=>{window.focus();location.href="messages.html";};}catch(e){}
      }
    }
    updateCount(total);
  }
  let refreshTimer=null;
  function applySession(session){
    if(!session){userId=null;bar.style.display="none";updateCount(0);if(channel){db.removeChannel(channel);channel=null;}if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}return;}
    userId=session.user.id;
    bar.style.display=location.pathname.endsWith("messages.html")?"none":"block";
    refresh(true);
    if(!refreshTimer)refreshTimer=setInterval(()=>refresh(false),12000);
    if(channel)db.removeChannel(channel);
    channel=db.channel("sexsi-global-chat-"+userId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"sexsi_messages",filter:"recipient_id=eq."+userId},()=>refresh(false))
      .subscribe();
  }
  db.auth.getSession().then(({data,error})=>{if(!error)applySession(data.session);});
  db.auth.onAuthStateChange((_event,session)=>applySession(session));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh(true);});
})();