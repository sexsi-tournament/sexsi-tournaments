const SUPABASE_URL = "https://fyxlwcoochsuzhqostpe.supabase.co";
const SUPABASE_KEY = "sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});
const ADMIN_ID = "13f1ada8-cd05-4c31-8940-4fb1790cb90e";
let currentUser=null, activeConversationId=null, activeOtherUser=null;
let conversations=[], friends=[], directory=[], requests=[], messageChannel=null;
const $=id=>document.getElementById(id);
function setStatus(message,isError=false){$("pageStatus").textContent=message||"";$("pageStatus").style.color=isError?"#ff777d":"#aaa";}
function initials(name){return String(name||"И").trim().slice(0,1).toUpperCase();}
function makeAvatar(name,isAdmin){const a=document.createElement("span");a.className="avatar"+(isAdmin?" admin-avatar":"");a.textContent=initials(name);return a;}
function formatTime(value){if(!value)return"";return new Date(value).toLocaleString("bg-BG",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}
function clearNode(node){node.replaceChildren();}
function openModal(id){$(id).hidden=false;}
function closeModal(id){$(id).hidden=true;}
function userFrom(row){return{user_id:row.user_id,username:row.username,player_id:row.player_id,is_admin:row.is_admin};}

async function loadFriends(){
  const {data,error}=await db.rpc("sexsi_friend_list");if(error)throw error;
  friends=Array.isArray(data)?data:[];
  const select=$("friendSelect");const selected=select.value;clearNode(select);
  const first=document.createElement("option");first.value="";first.textContent=friends.length?"Избери приятел...":"Все още нямаш приятели";select.appendChild(first);
  friends.forEach(friend=>{const option=document.createElement("option");option.value=friend.user_id;option.textContent=friend.username+(friend.player_id?" · "+friend.player_id:"");select.appendChild(option);});
  select.value=friends.some(f=>f.user_id===selected)?selected:"";
  $("startFriendChat").disabled=!friends.length;
}
async function loadDirectory(){
  const {data,error}=await db.rpc("sexsi_friend_directory");if(error)throw error;
  directory=Array.isArray(data)?data:[];
  renderCandidates();
}
async function loadRequests(){
  const {data,error}=await db.rpc("sexsi_friend_requests_list");if(error)throw error;
  requests=Array.isArray(data)?data:[];
  const incoming=requests.filter(r=>r.direction==="incoming").length;
  $("requestCount").textContent=incoming?("· "+incoming):"";
  $("requestCount").style.color="#ff6268";
  renderRequests();
}
function renderCandidates(){
  const target=$("candidateList");if(!target)return;clearNode(target);
  const q=$("friendSearch").value.trim().toLocaleLowerCase("bg");
  const rows=directory.filter(u=>(String(u.username||"").toLocaleLowerCase("bg").includes(q)||String(u.player_id||"").toLocaleLowerCase("bg").includes(q)));
  if(!rows.length){const p=document.createElement("p");p.className="empty";p.textContent="Няма намерени играчи.";target.appendChild(p);return;}
  rows.forEach(user=>{
    const card=document.createElement("div");card.className="candidate-card";card.appendChild(makeAvatar(user.username,user.is_admin));
    const info=document.createElement("span");info.className="user-info";
    const name=document.createElement("strong");name.textContent=user.username||"Играч";
    const meta=document.createElement("small");meta.textContent=user.is_admin?"АДМИНИСТРАТОР":(user.player_id?"GAME ID: "+user.player_id:"SEXSI TOURNAMENTS");
    info.append(name,meta);card.appendChild(info);
    const action=document.createElement("button");action.className="action-btn";action.type="button";
    if(user.relation_status==="friend"){action.textContent="ПРИЯТЕЛ";action.disabled=true;}
    else if(user.relation_status==="sent"){action.textContent="ИЗПРАТЕНА";action.disabled=true;}
    else if(user.relation_status==="received"){action.textContent="ИМА ПОКАНА";action.disabled=true;}
    else{action.textContent="ИЗПРАТИ ПОКАНА";action.classList.add("primary");action.addEventListener("click",()=>sendFriendRequest(user,action));}
    card.appendChild(action);target.appendChild(card);
  });
}
function renderRequests(){
  const target=$("requestsContent");clearNode(target);
  if(!requests.length){const p=document.createElement("p");p.className="empty";p.textContent="Нямаш активни покани за приятелство.";target.appendChild(p);return;}
  requests.forEach(req=>{
    const card=document.createElement("div");card.className="request-card";card.appendChild(makeAvatar(req.other_username,req.other_is_admin));
    const info=document.createElement("span");info.className="user-info";
    const name=document.createElement("strong");name.textContent=req.other_username||"Играч";
    const meta=document.createElement("small");meta.textContent=req.direction==="incoming"?"ИЗПРАТИ ТИ ПОКАНА": "ЧАКА ОТГОВОР";
    info.append(name,meta);card.appendChild(info);
    if(req.direction==="incoming"){
      const actions=document.createElement("div");actions.className="request-actions";
      const accept=document.createElement("button");accept.className="accept";accept.textContent="ПРИЕМИ";accept.addEventListener("click",()=>respondToRequest(req,true,accept));
      const reject=document.createElement("button");reject.textContent="ОТКАЖИ";reject.addEventListener("click",()=>respondToRequest(req,false,reject));
      actions.append(accept,reject);card.appendChild(actions);
    }else{
      const pending=document.createElement("small");pending.style.color="#d7ad60";pending.textContent="ИЗЧАКВА";card.appendChild(pending);
    }
    target.appendChild(card);
  });
}
async function sendFriendRequest(user,button){
  button.disabled=true;button.textContent="ИЗПРАЩАНЕ...";
  const {data,error}=await db.rpc("sexsi_friend_request_send",{p_user_id:user.user_id});
  if(error){setStatus("Поканата не беше изпратена: "+error.message,true);button.disabled=false;button.textContent="ИЗПРАТИ ПОКАНА";return;}
  await Promise.all([loadDirectory(),loadRequests()]);
  setStatus(data==="sent"?"Поканата за приятелство е изпратена.":data==="incoming_exists"?"Този играч вече ти е изпратил покана. Провери получените покани.":"Вече имате връзка или активна покана.");
}
async function respondToRequest(req,accept,button){
  button.disabled=true;button.textContent="...";
  const {error}=await db.rpc("sexsi_friend_request_respond",{p_request_id:req.request_id,p_accept:accept});
  if(error){setStatus("Неуспешна обработка на поканата: "+error.message,true);button.disabled=false;return;}
  await Promise.all([loadFriends(),loadRequests(),loadDirectory()]);
  setStatus(accept?"Вече сте приятели. Можете да започнете разговор.":"Поканата е отказана.");
}
async function loadConversations(){
  const {data,error}=await db.rpc("sexsi_chat_list");if(error)throw error;
  conversations=Array.isArray(data)?data:[];renderConversations();
  const unread=conversations.reduce((sum,item)=>sum+Number(item.unread_count||0),0);
  $("unreadTotal").textContent=unread>99?"99+":String(unread);$("unreadTotal").hidden=unread===0;
}
function renderConversations(){
  const list=$("conversationList");clearNode(list);
  if(!conversations.length){const p=document.createElement("p");p.className="empty";p.textContent="Все още нямаш разговори. Избери приятел от менюто горе.";list.appendChild(p);return;}
  conversations.forEach(item=>{
    const button=document.createElement("button");button.className="conversation-row"+(item.conversation_id===activeConversationId?" selected":"");button.type="button";
    button.appendChild(makeAvatar(item.other_username,item.other_is_admin));
    const info=document.createElement("span");info.className="user-info";
    const top=document.createElement("span");top.className="conversation-top";
    const name=document.createElement("strong");name.textContent=item.other_username||"Играч";
    const time=document.createElement("small");time.style.color="#888";time.textContent=formatTime(item.last_message_at);top.append(name,time);
    const preview=document.createElement("small");preview.className="preview";preview.textContent=item.last_message||"Започни разговор";
    info.append(top,preview);button.appendChild(info);
    const unread=Number(item.unread_count||0);if(unread){const badge=document.createElement("span");badge.className="unread";badge.textContent=unread>99?"99+":String(unread);button.appendChild(badge);}
    button.addEventListener("click",()=>openConversation(item.conversation_id,{user_id:item.other_user_id,username:item.other_username,player_id:item.other_player_id,is_admin:item.other_is_admin}));
    list.appendChild(button);
  });
}
async function startConversation(user){
  setStatus("Отваряне на разговор...");
  try{const {data,error}=await db.rpc("sexsi_chat_start",{p_other_user_id:user.user_id});if(error)throw error;await loadConversations();await openConversation(data,user);$("friendSelect").value=user.user_id;}
  catch(error){console.error(error);setStatus("Не успяхме да отворим разговора: "+error.message,true);}
}
async function openConversation(id,user){
  activeConversationId=id;activeOtherUser=user;$("emptyState").hidden=true;$("chatPanel").hidden=false;
  $("chatName").textContent=user.username||"Играч";document.body.classList.add("chat-open");
  $("chatSubline").textContent=user.is_admin?"АДМИНИСТРАТОР":(user.player_id?"GAME ID: "+user.player_id:"SEXSI TOURNAMENTS");
  $("chatAvatar").textContent=initials(user.username);$("chatAvatar").classList.toggle("admin-avatar",Boolean(user.is_admin));
  $("messageInput").disabled=false;$("sendButton").disabled=false;
  renderConversations();await loadMessages();
  await db.rpc("sexsi_chat_mark_read",{p_conversation_id:id});await loadConversations();subscribeToMessages();
}
async function loadMessages(){
  if(!activeConversationId)return;const list=$("messages");clearNode(list);
  const {data,error}=await db.from("sexsi_messages").select("id,conversation_id,sender_id,recipient_id,body,created_at,read_at").eq("conversation_id",activeConversationId).order("created_at",{ascending:true}).limit(150);
  if(error){setStatus("Не успяхме да заредим съобщенията: "+error.message,true);return;}
  if(!data||!data.length){const p=document.createElement("p");p.className="message-empty";p.textContent="Това е началото на разговора. Изпрати първото съобщение.";list.appendChild(p);}
  else data.forEach(renderMessage);
  list.scrollTop=list.scrollHeight;setStatus("");
}
function renderMessage(message){
  const wrap=document.createElement("div");const mine=message.sender_id===currentUser.id;wrap.className="message-line "+(mine?"mine":"theirs");
  const bubble=document.createElement("div");bubble.className="bubble";
  const body=document.createElement("div");body.className="bubble-body";body.textContent=message.body;
  const meta=document.createElement("div");meta.className="bubble-meta";meta.textContent=formatTime(message.created_at)+(mine?(message.read_at?" · Прочетено":" · Изпратено"):"");
  bubble.append(body,meta);wrap.appendChild(bubble);$("messages").appendChild(wrap);
}
async function sendMessage(){
  const body=$("messageInput").value.trim();if(!body||!activeConversationId||!activeOtherUser||!currentUser)return;
  $("sendButton").disabled=true;
  const {error}=await db.from("sexsi_messages").insert({conversation_id:activeConversationId,sender_id:currentUser.id,recipient_id:activeOtherUser.user_id,body});
  $("sendButton").disabled=false;if(error){setStatus("Съобщението не беше изпратено: "+error.message,true);return;}
  $("messageInput").value="";await loadMessages();await loadConversations();$("messageInput").focus();
}
function subscribeToMessages(){
  if(messageChannel)db.removeChannel(messageChannel);
  messageChannel=db.channel("sexsi-chat-"+currentUser.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"sexsi_messages"},async payload=>{
      const row=payload.new||payload.old;
      if(row&&row.conversation_id===activeConversationId){await loadMessages();await db.rpc("sexsi_chat_mark_read",{p_conversation_id:activeConversationId});}
      await loadConversations();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"sexsi_friend_requests"},async()=>{await Promise.all([loadFriends(),loadRequests(),loadDirectory()]);})
    .on("postgres_changes",{event:"*",schema:"public",table:"sexsi_friends"},async()=>{await loadFriends();})
    .subscribe();
}
async function boot(){
  const {data,error}=await db.auth.getSession();
  if(error||!data.session){$("loginRequired").hidden=false;$("chatApp").hidden=true;return;}
  currentUser=data.session.user;$("currentUserName").textContent=currentUser.user_metadata?.username||"Потребител";
  $("chatApp").hidden=false;$("loginRequired").hidden=true;
  try{await Promise.all([loadFriends(),loadDirectory(),loadRequests(),loadConversations()]);subscribeToMessages();}
  catch(err){console.error("Chat initialization:",err);setStatus("Чатът не може да се зареди: "+err.message,true);}
}
$("startFriendChat").addEventListener("click",()=>{
  const id=$("friendSelect").value;const friend=friends.find(f=>f.user_id===id);
  if(friend)startConversation(userFrom(friend));
});
$("openRequests").addEventListener("click",()=>openModal("requestsModal"));
$("openFindFriends").addEventListener("click",()=>{openModal("findModal");$("friendSearch").focus();});
$("friendSearch").addEventListener("input",renderCandidates);
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>closeModal(button.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",event=>{if(event.target===backdrop)closeModal(backdrop.id);}));
$("sendButton").addEventListener("click",sendMessage);
$("messageInput").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendMessage();}});
$("enableNotifications").addEventListener("click",async()=>{
  if(!("Notification" in window)){setStatus("Браузърът не поддържа известия.",true);return;}
  const permission=await Notification.requestPermission();
  $("enableNotifications").textContent=permission==="granted"?"✓ ИЗВЕСТИЯ":"🔔 ИЗВЕСТИЯ";
  setStatus(permission==="granted"?"Известията са разрешени.":permission==="denied"?"Известията са блокирани от браузъра.":"Не е дадено разрешение.");
});
$("backToConversations").addEventListener("click",()=>{document.body.classList.remove("chat-open");});
$("backToProfile").addEventListener("click",()=>window.location.href="profile.html");
$("logoutChat").addEventListener("click",async()=>{await db.auth.signOut();window.location.href="profile.html";});
boot();
