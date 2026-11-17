const SUPABASE_URL = "https://fyxlwcoochsuzhqostpe.supabase.co";
const SUPABASE_KEY = "sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});

const ADMIN_ID = "13f1ada8-cd05-4c31-8940-4fb1790cb90e";
let currentUser = null;
let activeConversationId = null;
let activeOtherUser = null;
let users = [];
let conversations = [];
let messageChannel = null;

const $ = id => document.getElementById(id);

function setStatus(message, isError = false) {
  $("pageStatus").textContent = message || "";
  $("pageStatus").style.color = isError ? "#ff777d" : "#aaa";
}

function initials(name) {
  return String(name || "И").trim().slice(0, 1).toUpperCase();
}

function makeAvatar(name, isAdmin) {
  const avatar = document.createElement("span");
  avatar.className = "avatar" + (isAdmin ? " admin-avatar" : "");
  avatar.textContent = initials(name);
  return avatar;
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("bg-BG", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

async function loadDirectory() {
  const { data, error } = await db.rpc("sexsi_chat_users");
  if (error) throw error;
  users = Array.isArray(data) ? data : [];
  renderDirectory();
}

function renderDirectory() {
  const query = $("userSearch").value.trim().toLocaleLowerCase("bg");
  const list = $("userDirectory");
  clearNode(list);

  const filtered = users.filter(user =>
    String(user.username || "").toLocaleLowerCase("bg").includes(query) ||
    String(user.player_id || "").toLocaleLowerCase("bg").includes(query)
  );

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = query ? "Няма намерени потребители." : "Няма други регистрирани потребители.";
    list.appendChild(empty);
    return;
  }

  filtered.forEach(user => {
    const button = document.createElement("button");
    button.className = "user-row";
    button.type = "button";
    button.appendChild(makeAvatar(user.username, user.is_admin));

    const info = document.createElement("span");
    info.className = "user-info";
    const name = document.createElement("strong");
    name.textContent = user.username || "Играч";
    const detail = document.createElement("small");
    detail.textContent = user.is_admin ? "АДМИНИСТРАТОР" : (user.player_id ? "GAME ID: " + user.player_id : "Играч");
    info.append(name, detail);
    button.appendChild(info);

    const arrow = document.createElement("span");
    arrow.className = "row-arrow";
    arrow.textContent = "›";
    button.appendChild(arrow);

    button.addEventListener("click", () => startConversation(user));
    list.appendChild(button);
  });
}

async function loadConversations() {
  const { data, error } = await db.rpc("sexsi_chat_list");
  if (error) throw error;
  conversations = Array.isArray(data) ? data : [];
  renderConversations();

  const unread = conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
  $("unreadTotal").textContent = unread > 99 ? "99+" : String(unread);
  $("unreadTotal").hidden = unread === 0;
}

function renderConversations() {
  const list = $("conversationList");
  clearNode(list);

  if (!conversations.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Все още нямаш разговори. Избери играч от списъка по-долу.";
    list.appendChild(empty);
    return;
  }

  conversations.forEach(item => {
    const button = document.createElement("button");
    button.className = "conversation-row" + (item.conversation_id === activeConversationId ? " selected" : "");
    button.type = "button";
    button.appendChild(makeAvatar(item.other_username, item.other_is_admin));

    const info = document.createElement("span");
    info.className = "conversation-info";
    const top = document.createElement("span");
    top.className = "conversation-top";
    const name = document.createElement("strong");
    name.textContent = item.other_username || "Играч";
    const time = document.createElement("small");
    time.textContent = formatTime(item.last_message_at);
    top.append(name, time);
    const preview = document.createElement("small");
    preview.className = "preview";
    preview.textContent = item.last_message || "Започни разговор";
    info.append(top, preview);
    button.appendChild(info);

    const unread = Number(item.unread_count || 0);
    if (unread > 0) {
      const badge = document.createElement("span");
      badge.className = "unread-badge";
      badge.textContent = unread > 99 ? "99+" : String(unread);
      button.appendChild(badge);
    }

    button.addEventListener("click", () => openConversation(item.conversation_id, {
      user_id: item.other_user_id,
      username: item.other_username,
      player_id: item.other_player_id,
      is_admin: item.other_is_admin
    }));
    list.appendChild(button);
  });
}

async function startConversation(user) {
  setStatus("Отваряне на разговор...");
  try {
    const { data, error } = await db.rpc("sexsi_chat_start", {
      p_other_user_id: user.user_id
    });
    if (error) throw error;
    await loadConversations();
    await openConversation(data, user);
    $("userSearch").value = "";
    renderDirectory();
  } catch (error) {
    console.error("Chat start error:", error);
    setStatus("Не успяхме да отворим разговора: " + error.message, true);
  }
}

async function openConversation(conversationId, user) {
  activeConversationId = conversationId;
  activeOtherUser = user;
  $("emptyState").hidden = true;
  $("chatPanel").hidden = false;
  $("chatName").textContent = user.username || "Играч";
  $("chatSubline").textContent = user.is_admin ? "АДМИНИСТРАТОР" : (user.player_id ? "GAME ID: " + user.player_id : "SEXSI TOURNAMENTS");
  $("chatAvatar").textContent = initials(user.username);
  $("chatAvatar").classList.toggle("admin-avatar", Boolean(user.is_admin));
  $("messageInput").disabled = false;
  $("sendButton").disabled = false;
  $("messageInput").focus();

  renderConversations();
  await loadMessages();
  await db.rpc("sexsi_chat_mark_read", { p_conversation_id: conversationId });
  await loadConversations();
  subscribeToMessages();
}

async function loadMessages() {
  if (!activeConversationId) return;
  const list = $("messages");
  clearNode(list);

  const { data, error } = await db
    .from("sexsi_messages")
    .select("id, conversation_id, sender_id, recipient_id, body, created_at, read_at")
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: true })
    .limit(150);

  if (error) {
    setStatus("Не успяхме да заредим съобщенията: " + error.message, true);
    return;
  }

  if (!data || !data.length) {
    const empty = document.createElement("p");
    empty.className = "message-empty";
    empty.textContent = "Това е началото на разговора. Изпрати първото съобщение.";
    list.appendChild(empty);
  } else {
    data.forEach(renderMessage);
  }
  list.scrollTop = list.scrollHeight;
  setStatus("");
}

function renderMessage(message) {
  const list = $("messages");
  const wrap = document.createElement("div");
  const mine = message.sender_id === currentUser.id;
  wrap.className = "message-line " + (mine ? "mine" : "theirs");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const body = document.createElement("div");
  body.className = "bubble-body";
  body.textContent = message.body;
  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  meta.textContent = formatTime(message.created_at) + (mine ? (message.read_at ? " · Прочетено" : " · Изпратено") : "");
  bubble.append(body, meta);
  wrap.appendChild(bubble);
  list.appendChild(wrap);
}

async function sendMessage() {
  const body = $("messageInput").value.trim();
  if (!body || !activeConversationId || !activeOtherUser || !currentUser) return;

  $("sendButton").disabled = true;
  const { error } = await db.from("sexsi_messages").insert({
    conversation_id: activeConversationId,
    sender_id: currentUser.id,
    recipient_id: activeOtherUser.user_id,
    body
  });

  $("sendButton").disabled = false;
  if (error) {
    setStatus("Съобщението не беше изпратено: " + error.message, true);
    return;
  }

  $("messageInput").value = "";
  await loadMessages();
  await loadConversations();
  $("messageInput").focus();
}

function subscribeToMessages() {
  if (messageChannel) db.removeChannel(messageChannel);

  messageChannel = db.channel("sexsi-chat-" + currentUser.id)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "sexsi_messages"
    }, async payload => {
      const row = payload.new || payload.old;
      if (row && row.conversation_id === activeConversationId) {
        await loadMessages();
        await db.rpc("sexsi_chat_mark_read", { p_conversation_id: activeConversationId });
      }
      await loadConversations();
    })
    .subscribe();
}

async function boot() {
  const { data, error } = await db.auth.getSession();
  if (error || !data.session) {
    $("loginRequired").hidden = false;
    $("chatApp").hidden = true;
    return;
  }

  currentUser = data.session.user;
  $("currentUserName").textContent = currentUser.user_metadata?.username || "Потребител";
  $("chatApp").hidden = false;
  $("loginRequired").hidden = true;

  try {
    await Promise.all([loadDirectory(), loadConversations()]);
    subscribeToMessages();
  } catch (err) {
    console.error("Chat initialization error:", err);
    setStatus("Чатът не може да се зареди. Провери дали SQL настройката е изпълнена. " + err.message, true);
  }
}

$("userSearch").addEventListener("input", renderDirectory);
$("sendButton").addEventListener("click", sendMessage);
$("messageInput").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
$("backToProfile").addEventListener("click", () => {
  window.location.href = "profile.html";
});
$("logoutChat").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "profile.html";
});

boot();
