
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
}

async function loadPlayerProfile(user) {
  const { data, error } = await db.rpc("sexsi_get_my_player_id");

  if (error) {
    console.error("Player ID error:", error.message);
  }

  showPlayerDashboard(user, data || "");
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
      emailRedirectTo: "https://sexsi-tournament.github.io/sexsi-tournaments/",
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
