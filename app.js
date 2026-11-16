
const SUPABASE_URL = "https://fyxlwcoochsuzhqostpe.supabase.co";
const SUPABASE_KEY = "sb_publishable_B_y2VUBIRuOdtN_57EJplQ_e-xoC5YP";

if (!window.sexsiSupabase && window.supabase) {
  window.sexsiSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );
}

const db = window.sexsiSupabase;
const ADMIN_ID = "13f1ada8-cd05-4c31-8940-4fb1790cb90e";

function showPlayerDashboard(user, playerId) {
  document.getElementById("register").style.display = "none";
  document.getElementById("playerDashboard").style.display = "block";

  document.getElementById("playerName").textContent =
    user.user_metadata?.username || "PLAYER";

  document.getElementById("playerEmail").textContent =
    user.email || "";

  document.getElementById("playerId").textContent =
    playerId || "НЯМА ДОБАВЕНО ID";

  document.getElementById("editPlayerGameId").value =
    playerId || "";

  const isAdmin = user.id === ADMIN_ID;

  document.getElementById("adminPanel").style.display =
    isAdmin ? "block" : "none";

  loadTournamentRegistration(playerId);
  loadPlayerXP();
  loadMyTournamentMatches(user.id);
  loadMyRewardPayouts(user.id);
}

async function loadPlayerXP() {
  const rankBadge = document.getElementById("playerRankBadge");
  const totalElement = document.getElementById("playerTotalXP");
  const progressElement = document.getElementById("playerXPProgress");
  const progressText = document.getElementById("playerXPProgressText");
  const remainingElement = document.getElementById("playerXPRemaining");
  const message = document.getElementById("playerXPMessage");

  if (!rankBadge || !totalElement || !progressElement ||
      !progressText || !remainingElement || !message) return;

  message.textContent = "Зареждане на нивото...";

  const { data, error } = await db.rpc("sexsi_get_my_xp");

  if (error) {
    console.error("Player XP error:", error.message);
    message.textContent = "XP информацията временно не е достъпна.";
    return;
  }

  const xpData = Array.isArray(data) ? data[0] : data;

  if (!xpData) {
    message.textContent = "Все още няма налична XP информация.";
    return;
  }

  const totalXP = Math.max(0, Number(xpData.total_xp) || 0);
  const progress = Math.min(100, Math.max(0, Number(xpData.progress_percent) || 0));
  const rank = xpData.rank_name || "Rookie";
  const nextRankXP = xpData.next_rank_xp;
  const xpRemaining = Math.max(0, Number(xpData.xp_to_next) || 0);

  const nextRankNames = {
    Rookie: "AMATEUR",
    Amateur: "PRO",
    Pro: "ELITE",
    Elite: "LEGEND"
  };

  const rankKey = String(rank).toLowerCase();
  rankBadge.textContent = String(rank).toUpperCase();
  rankBadge.className = "rank-badge rank-" + rankKey;
  const levelCard = document.getElementById("playerLevelCard");
  if (levelCard) {
    levelCard.classList.remove("rank-rookie", "rank-amateur", "rank-pro", "rank-elite", "rank-legend");
    levelCard.classList.add("rank-" + rankKey);
  }
  totalElement.textContent = totalXP.toLocaleString("bg-BG") + " XP";
  progressElement.style.width = progress + "%";

  if (nextRankXP === null || nextRankXP === undefined) {
    progressText.textContent = "МАКСИМАЛНО НИВО";
    remainingElement.textContent = "Достигнат е ранг LEGEND";
  } else {
    progressText.textContent =
      totalXP.toLocaleString("bg-BG") + " / " +
      Number(nextRankXP).toLocaleString("bg-BG") + " XP";
    remainingElement.textContent =
      xpRemaining.toLocaleString("bg-BG") + " XP до " +
      (nextRankNames[rank] || "СЛЕДВАЩИЯ РАНГ");
  }

  message.textContent = "";
}


async function loadMyRewardPayouts(userId){
  const container=document.getElementById("myRewardPayouts");
  if(!container)return;
  container.replaceChildren();
  if(!userId){
    container.textContent="Влез в профила си, за да виждаш наградите.";
    return;
  }

  const {data,error}=await db.rpc("sexsi_get_my_reward");
  if(error){
    console.error("My rewards error:",error.message);
    container.textContent="Наградите временно не са достъпни.";
    return;
  }

  const rewards=Array.isArray(data)?data:[];
  if(!rewards.length){
    container.textContent="Все още нямаш регистрирани награди.";
    return;
  }

  rewards.forEach(item=>{
    const card=document.createElement("article");
    card.style.cssText="padding:14px;margin-top:10px;background:#151515;border:1px solid #383033;border-radius:7px";

    const title=document.createElement("strong");
    title.textContent="SEXSI 1V1 CUP #001";
    const amount=document.createElement("p");
    amount.textContent=Number(item.reward_amount).toLocaleString("bg-BG")+" "+item.reward_currency;

    const status=document.createElement("p");
    if(item.reward_status==="confirmed"){
      status.textContent="ПОЛУЧАВАНЕТО Е ПОТВЪРДЕНО"+(item.confirmed_at?" · "+new Date(item.confirmed_at).toLocaleString("bg-BG"):"");
      status.style.color="#65e69a";
    }else if(item.reward_status==="sent"){
      status.textContent="НАГРАДАТА Е ИЗПРАТЕНА"+(item.sent_at?" · "+new Date(item.sent_at).toLocaleString("bg-BG"):"");
      status.style.color="#e9bd59";
    }else{
      status.textContent="НАГРАДАТА ОЧАКВА ИЗПЛАЩАНЕ";
      status.style.color="#aaa";
    }

    card.append(title,amount,status);

    if(item.proof_path){
      const proofButton=document.createElement("button");
      proofButton.type="button";
      proofButton.textContent="ВИЖ ДОКАЗАТЕЛСТВОТО";
      proofButton.style.marginRight="8px";
      proofButton.addEventListener("click",async()=>{
        const {data:proofData,error:proofError}=await db.storage.from("reward-proofs").createSignedUrl(item.proof_path,300);
        if(proofError){
          alert("Доказателството временно не може да бъде отворено: "+proofError.message);
          return;
        }
        window.open(proofData.signedUrl,"_blank","noopener");
      });
      card.appendChild(proofButton);
    }

    if(item.reward_status==="sent"){
      const button=document.createElement("button");
      button.type="button";
      button.textContent="ПОТВЪРДИ ПОЛУЧАВАНЕТО";
      button.addEventListener("click",async()=>{
        if(!confirm("Потвърждаваш ли, че получи 5000 Gold?"))return;
        button.disabled=true;
        button.textContent="ПОТВЪРЖДАВАНЕ...";
        const {error:confirmError}=await db.rpc("sexsi_confirm_reward",{
          p_reward_id:item.reward_id
        });
        if(confirmError){
          alert("Грешка при потвърждаване: "+confirmError.message);
          button.disabled=false;
          button.textContent="ПОТВЪРДИ ПОЛУЧАВАНЕТО";
          return;
        }
        await loadMyRewardPayouts(userId);
      });
      card.appendChild(button);
    }

    container.appendChild(card);
  });
}

async function loadPlayerProfile(user) {
  const { data, error } = await db.rpc("sexsi_get_my_player_id");

  if (error) {
    console.error("Player ID error:", error.message);
  }

  showPlayerDashboard(user, data || "");
}

/* ЛИЧНИ ТУРНИРИ НА ИГРАЧА */
async function loadMyTournamentMatches(userId) {
  const container = document.getElementById("myTournamentMatches");
  if (!container) return;

  container.replaceChildren();
  const note = document.createElement("p");
  note.className = "message";
  note.textContent = "Зареждане на личните двубои...";
  container.appendChild(note);

  if (!userId) {
    note.textContent = "Влез в профила си, за да виждаш личните си двубои.";
    return;
  }

  const { data, error } = await db.rpc("sexsi_get_public_bracket");
  if (error) {
    console.error("My tournaments error:", error.message);
    note.textContent = "Информацията за двубоите временно не е достъпна.";
    return;
  }

  const matches = Array.isArray(data) ? data : [];
  const { data: scheduleData, error: scheduleError } = await db.rpc("sexsi_get_public_match_schedules");
  if (scheduleError) {
    console.error("Match schedules error:", scheduleError.message);
  } else {
    const schedules = new Map((Array.isArray(scheduleData) ? scheduleData : []).map(item => [item.match_id, item.scheduled_at]));
    matches.forEach(match => { match.scheduled_at = schedules.get(match.id) || null; });
  }
  const mine = matches.filter(match =>
    match.player1_id === userId || match.player2_id === userId
  );

  if (!mine.length) {
    note.textContent = matches.length
      ? "Турнирната схема е създадена, но все още няма двубой, свързан с твоя профил. Провери дали Game ID-то ти съвпада с регистрацията."
      : "Записването ти се управлява отделно. Личните двубои ще се появят тук след създаването на турнирната схема.";
    return;
  }

  note.textContent = "Твоите двубои в SEXSI 1V1 CUP #001";
  mine.sort((a,b) =>
    Number(a.round_number) - Number(b.round_number) ||
    Number(a.match_number) - Number(b.match_number)
  );

  mine.forEach(match => {
    const card = document.createElement("article");
    card.style.cssText = "padding:14px;background:#151515;border:1px solid #383033;border-radius:7px";

    const heading = document.createElement("strong");
    heading.textContent = "КРЪГ " + (match.round_number || "—") + " · МАЧ №" + (match.match_number || "—");

    const opponent = document.createElement("p");
    opponent.style.cssText = "margin:9px 0;color:#ddd";
    const isPlayer1 = match.player1_id === userId;
    const opponentName = isPlayer1 ? match.player2_name : match.player1_name;
    opponent.textContent = "ПРОТИВНИК: " + (opponentName || "Очаква се");

    const schedule = document.createElement("p");
    schedule.style.cssText = "margin:6px 0;color:#e9bd59;font-size:13px;font-weight:bold";
    schedule.textContent = match.scheduled_at
      ? "НАСРОЧЕН ДВУБОЙ: " + new Date(match.scheduled_at).toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" })
      : "ЧАС: Все още не е уговорен";

    const result = document.createElement("p");
    result.style.cssText = "margin:6px 0;color:#aaa;font-size:13px";
    result.textContent = "РЕЗУЛТАТ: " +
      (match.score_player1 == null ? "—" : match.score_player1) + " : " +
      (match.score_player2 == null ? "—" : match.score_player2);

    const status = document.createElement("p");
    status.style.cssText = "margin:6px 0;font-size:12px;font-weight:bold;color:" +
      (match.status === "completed" ? "#65e69a" : "#e9bd59");
    status.textContent = match.status === "completed"
      ? (match.winner_id === userId ? "ПОБЕДА" : "ЗАГУБА") + (match.winner_name ? " · " + match.winner_name : "")
      : match.status === "ongoing" ? "ДВУБОЯТ Е В ХОД" : "ПРЕДСТОИ";

    card.append(heading, opponent, schedule, result, status);
    container.appendChild(card);
  });
}

const refreshMyTournamentsButton = document.getElementById("refreshMyTournaments");
if (refreshMyTournamentsButton) {
  refreshMyTournamentsButton.addEventListener("click", async function() {
    refreshMyTournamentsButton.disabled = true;
    refreshMyTournamentsButton.textContent = "ОБНОВЯВАНЕ...";
    const { data } = await db.auth.getSession();
    const userId = data.session?.user?.id || "";
    await loadMyTournamentMatches(userId);
    refreshMyTournamentsButton.disabled = false;
    refreshMyTournamentsButton.textContent = "ОБНОВИ ИНФОРМАЦИЯТА";
  });
}

// РЕГИСТРАЦИЯ
document.getElementById("registerForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const playerGameId = document.getElementById("playerGameId").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const message = document.getElementById("registerMessage");
  message.textContent = "Създаване на акаунт...";

  const { error } = await db.auth.signUp({
    email: email,
    password: password,
    options: {
      emailRedirectTo: new URLSearchParams(window.location.search).get("join") === "SEXSI-1V1-001"
        ? "https://sexsi-tournament.github.io/sexsi-tournaments/profile.html?join=SEXSI-1V1-001"
        : "https://sexsi-tournament.github.io/sexsi-tournaments/",
      data: {
        username: username,
        player_id: playerGameId
      }
    }
  });

  if (error) {
    message.textContent = "Грешка: " + error.message;
    return;
  }

  message.textContent =
    "Успешна регистрация! Провери имейла си за потвърждение.";
});

// ВХОД
document.getElementById("loginForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const message = document.getElementById("loginMessage");

  message.textContent = "Влизане...";

  const { data, error } = await db.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    message.textContent = "Грешка: " + error.message;
    return;
  }

  message.textContent = "Успешен вход!";

  await loadPlayerProfile(data.user);
});

// ВЪЗСТАНОВЯВАНЕ НА СЕСИЯТА
(async function restorePlayerSession() {
  const { data, error } = await db.auth.getSession();

  if (error || !data.session) return;

  await loadPlayerProfile(data.session.user);
})();


/* ЗАПИСВАНЕ ЗА SEXSI 1V1 CUP #001 */
async function loadTournamentRegistration(playerId) {
  const button = document.getElementById("tournamentSignupButton");
  const message = document.getElementById("tournamentSignupMessage");
  const countElement = document.getElementById("tournamentSignupCount");
  if (!button || !message || !countElement) return;

  button.disabled = true;
  button.textContent = "ПРОВЕРКА...";

  const [{ data: status, error: statusError }, { data: count, error: countError }] =
    await Promise.all([
      db.rpc("sexsi_get_my_tournament_status"),
      db.rpc("sexsi_get_registration_count")
    ]);

  if (countError || !Number.isInteger(Number(count))) {
    countElement.textContent = "Временно недостъпно";
  } else {
    countElement.textContent = String(count);
  }

  if (statusError) {
    message.textContent = "Не успяхме да проверим записването. Опитай отново.";
    button.disabled = false;
    button.textContent = "ПРОВЕРИ ОТНОВО";
    return;
  }

  if (status === "registered") {
    button.textContent = "ВЕЧЕ СИ ЗАПИСАН";
    button.disabled = true;
    message.textContent = "Участието ти в SEXSI 1V1 CUP #001 е потвърдено.";
    return;
  }

  if (!playerId) {
    button.textContent = "ДОБАВИ GAME ID";
    button.disabled = true;
    message.textContent = "Първо добави валидно Standoff 2 ID в профила си.";
    return;
  }

  if (!countError && Number(count) >= 16) {
    button.textContent = "МЕСТАТА СА ЗАПЪЛНЕНИ";
    button.disabled = true;
    message.textContent = "Турнирът вече има 16 участници.";
    return;
  }

  button.disabled = false;
  button.textContent = "ЗАПИШИ СЕ ЗА ТУРНИРА";
  message.textContent = "Все още не си записан за турнира.";

  if (new URLSearchParams(window.location.search).get("join") === "SEXSI-1V1-001") {
    document.getElementById("tournamentSignupCard").scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

const tournamentSignupButton = document.getElementById("tournamentSignupButton");
if (tournamentSignupButton) {
  tournamentSignupButton.addEventListener("click", async function() {
    const message = document.getElementById("tournamentSignupMessage");
    tournamentSignupButton.disabled = true;
    tournamentSignupButton.textContent = "ЗАПИСВАНЕ...";

    const { data, error } = await db.rpc("sexsi_register_for_tournament");

    if (error) {
      message.textContent = "Грешка при записването: " + error.message;
      tournamentSignupButton.disabled = false;
      tournamentSignupButton.textContent = "ОПИТАЙ ОТНОВО";
      return;
    }

    const playerId = document.getElementById("playerId").textContent;
    await loadTournamentRegistration(playerId === "НЯМА ДОБАВЕНО ID" ? "" : playerId);

    if (data === "registered") {
      message.textContent = "Успешно се записа за SEXSI 1V1 CUP #001!";
    } else if (data === "already_registered") {
      message.textContent = "Вече си записан за този турнир.";
    } else if (data === "full") {
      message.textContent = "Местата са запълнени. Турнирът е с максимум 16 участници.";
    } else if (data === "missing_player_id") {
      message.textContent = "Първо добави валидно Standoff 2 ID в профила си.";
    } else if (data === "not_logged_in") {
      message.textContent = "Трябва да влезеш в профила си.";
    } else {
      message.textContent = "Получен е неочакван отговор от сървъра.";
    }
  });
}

// ПРОМЯНА НА STANDOFF 2 ID
document.getElementById("savePlayerGameId").addEventListener("click", async function() {
  const playerGameId =
    document.getElementById("editPlayerGameId").value.trim();

  const message = document.getElementById("playerGameIdMessage");

  if (!playerGameId) {
    message.textContent = "Въведи ID в Standoff 2!";
    return;
  }

  message.textContent = "Запазване...";

  const { error } = await db.rpc("sexsi_set_my_player_id", {
    p_player_id: playerGameId
  });

  if (error) {
    message.textContent = "Грешка: " + error.message;
    return;
  }

  document.getElementById("playerId").textContent = playerGameId;
  message.textContent = "ID-то е запазено успешно!";
});

// ИЗХОД ОТ ПРОФИЛА
document.getElementById("logoutButton").addEventListener("click", async function() {
  const { error } = await db.auth.signOut();

  if (error) {
    alert("Грешка при изход: " + error.message);
    return;
  }

  document.getElementById("playerDashboard").style.display = "none";
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("register").style.display = "block";
});
