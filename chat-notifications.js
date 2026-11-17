(function(){
  "use strict";
  const URL="https://fyxlwcoochsuzhqostpe.supabase.co";
  const KEY="sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";
  if(!window.supabase||!window.supabase.createClient)return;
  const db=window.sexsiSupabase||window.supabase.createClient(URL,KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
  let userId=null, unreadTotal=0, channel=null, lastToastAt=0;
  const style=document.createElement("style");
  style.textContent="#sexsiChatNotice{position:fixed;right:16px;bottom:16px;z-index:99990;display:flex;align-items:center;gap:9px;padding:10px 12px;background:#111;border:1px solid #713036;border-radius:9px;box-shadow:0 8px 30px #0009;color:#fff;font: bold 11px Arial}#sexsiChatNotice a{color:#fff;text-decoration:none}#sexsiChatNotice .count{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;background:#ed252d;border-radius:20px}#sexsiChatNotice button{padding:7px 9px;border:1px solid #555;border-radius:5px;background:#222;color:#ddd;font:bold 10px Arial}#sexsiChatToast{position:fixed;right:16px;bottom:68px;z-index:99991;max-width:min(340px,calc(100vw - 32px));padding:13px 15px;background:#211012;border:1px solid #ed252d;border-radius:8px;color:#fff;font:12px/1.5 Arial;box-shadow:0 8px 30px #0009}#sexsiChatToast[hidden]{display:none}";
  document.head.appendChild(style);
  const bar=document.createElement("div");
  bar.id="sexsiChatNotice";
  bar.innerHTML='<a href="messages.html">✉ СЪОБЩЕНИЯ <span class="count" id="sexsiChatCount" hidden>0</span></a><button id="sexsiEnableNotifications" type="button">ВКЛЮЧИ ИЗВЕСТИЯ</button>';
  document.body.appendChild(bar);
  const toast=document.createElement("div");toast.id="sexsiChatToast";toast.hidden=true;document.body.appendChild(toast);
  const countEl=document.getElementById("sexsiChatCount");
  const enable=document.getElementById("sexsiEnableNotifications");
  function updateCount(n){unreadTotal=n;countEl.textContent=n>99?"99+":String(n);countEl.hidden=n===0;bar.style.borderColor=n?"#ed252d":"#713036";}
  function showToast(text){
    toast.textContent=text;toast.hidden=false;
    clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.hidden=true,5000);
  }
  async function refresh(silent){
    if(!userId)return;
    const {data,error}=await db.rpc("sexsi_chat_list");
    if(error){console.warn("SEXSI chat notifications:",error.message);return;}
    const rows=Array.isArray(data)?data:[];
    const total=rows.reduce((sum,row)=>sum+Number(row.unread_count||0),0);
    if(!silent&&total>unreadTotal){
      const latest=rows.find(row=>Number(row.unread_count||0)>0);
      const who=latest?.other_username||"Играч";
      showToast("Ново съобщение от "+who+". Натисни тук, за да отвориш чата.");
      toast.style.cursor="pointer";toast.onclick=()=>location.href="messages.html";
      if(document.hidden&&"Notification" in window&&Notification.permission==="granted"){
        try{new Notification("SEXSI TOURNAMENTS",{body:"Ново съобщение от "+who,tag:"sexsi-chat"}).onclick=()=>{window.focus();location.href="messages.html";};}catch(e){}
      }
    }
    updateCount(total);
  }
  enable.addEventListener("click",async()=>{
    if(!("Notification" in window)){showToast("Този браузър не поддържа известия.");return;}
    const permission=await Notification.requestPermission();
    enable.textContent=permission==="granted"?"ИЗВЕСТИЯТА СА ВКЛЮЧЕНИ":permission==="denied"?"ИЗВЕСТИЯТА СА БЛОКИРАНИ":"ВКЛЮЧИ ИЗВЕСТИЯ";
    if(permission==="granted")showToast("Известията за нови съобщения са включени.");
  });
  db.auth.getSession().then(({data,error})=>{
    if(error||!data.session)return;
    userId=data.session.user.id;
    refresh(true);
    setInterval(()=>refresh(false),12000);
    channel=db.channel("sexsi-global-chat-"+userId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"sexsi_messages",filter:"recipient_id=eq."+userId},payload=>{
        if(payload.new&&payload.new.sender_id!==userId)refresh(false);
      }).subscribe();
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh(true);});
})();