import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const ADMIN_ID = "13f1ada8-cd05-4c31-8940-4fb1790cb90e";
const CHANNEL_ID = "1572861675223257188";
const SITE_URL = "https://sexsi-tournament.github.io/sexsi-tournaments/";
const BRACKET_URL = "https://sexsi-tournament.github.io/sexsi-tournaments/bracket.html";

function bgDate(value: string) {
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}

const translationCache = new Map<string, string>();
async function translateBgEn(value: string): Promise<string> {
  const original = String(value ?? "");
  if (translationCache.has(original)) return translationCache.get(original)!;
  if (!original.trim() || new TextEncoder().encode(original).length > 480 || original.includes("https://") || original.includes("http://")) return original;
  try {
    const params = new URLSearchParams({ q: original, langpair: "bg|en", mt: "1" });
    const response = await fetch("https://api.mymemory.translated.net/get?" + params.toString(), { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(6500) });
    if (!response.ok) return original;
    const data = await response.json();
    const translated = String(data?.responseData?.translatedText ?? "").trim();
    if (Number(data?.responseStatus) !== 200 || !translated || translated.toUpperCase().includes("MYMEMORY WARNING")) return original;
    if (translationCache.size > 300) translationCache.clear();
    translationCache.set(original, translated);
    return translated;
  } catch (error) { console.warn("MyMemory translation unavailable:", error); return original; }
}
async function addEnglishTranslation(payload: any) {
  for (const embed of payload.embeds ?? []) {
    if (embed.title) { const original = embed.title; const plain = original.replace("🏆 ", ""); const en = await translateBgEn(plain); if (en !== plain) embed.title = original + " | " + en; }
    if (embed.description) { const original = embed.description; const en = await translateBgEn(original); if (en !== original) embed.description = original + "\n\n━━━━━━━━━━━━━━━━\n🇬🇧 " + en; }
    for (const field of embed.fields ?? []) { if (field.name) { const original = field.name; const en = await translateBgEn(original); if (en !== original) field.name = original + " / " + en; } if (field.value && !/[0-9]/.test(String(field.value)) && !String(field.value).includes("http")) { const originalValue = String(field.value); const valueEn = await translateBgEn(originalValue); if (valueEn !== originalValue) field.value = originalValue + "\n🇬🇧 " + valueEn; } }
    if (embed.footer?.text) { const original = embed.footer.text; const en = await translateBgEn(original); if (en !== original) embed.footer.text = original + " | " + en; }
  }
  for (const row of payload.components ?? []) for (const component of row.components ?? []) if (component.label) { const original = component.label; const en = await translateBgEn(original); if (en !== original) component.label = original + " / " + en; }
  return payload;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://sexsi-tournament.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || authData.user?.id !== ADMIN_ID) {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: tournament, error } = await db.from("tournaments")
    .select("id,name,description,game_mode,max_players,prize,entry_type,entry_fee,status,start_at,registration_deadline")
    .eq("id", "7c6f2c43-b25d-4a44-a991-4495126e78b1").single();
  if (error || !tournament) return Response.json({ error: "Tournament data unavailable" }, { status: 500, headers: corsHeaders });

  const { count, error: countError } = await db.from("tournament_registrations")
    .select("id", { count: "exact", head: true }).eq("tournament_id", "SEXSI-1V1-001");
  if (countError) return Response.json({ error: "Registration count unavailable" }, { status: 500, headers: corsHeaders });

  const status = tournament.status === "open" ? "ОТВОРЕН" :
    tournament.status === "closed" ? "ЗАТВОРЕН" :
    tournament.status === "completed" ? "ПРИКЛЮЧИЛ" : String(tournament.status).toUpperCase();

  const payload = {
    embeds: [{
      title: "🏆 " + tournament.name,
      description: "Официален турнир по **Standoff 2** за българската общност SEXSI.",
      color: 15548997,
      fields: [
        { name: "🎮 Режим", value: "1v1 · BO1", inline: true },
        { name: "📊 Статус", value: status, inline: true },
        { name: "👥 Участници", value: String(count ?? 0) + "/" + String(tournament.max_players), inline: true },
        { name: "📝 Краен срок за записване", value: bgDate(tournament.registration_deadline) + " ч.", inline: false },
        { name: "🚀 Начало на турнира", value: bgDate(tournament.start_at) + " ч.", inline: false },
        { name: "🏅 Отличие", value: tournament.prize || "Специална награда", inline: false }
      ],
      footer: { text: "SEXSI TOURNAMENTS · Официална турнирна информация" }
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 1, label: "ЗАПИШИ СЕ", custom_id: "sexsi_signup:" + tournament.id },
        { type: 2, style: 5, label: "ОТВОРИ САЙТА", url: SITE_URL },
        { type: 2, style: 5, label: "ТУРНИРНА СХЕМА", url: BRACKET_URL }
      ]
    }]
  };

  await addEnglishTranslation(payload);
  const response = await fetch("https://discord.com/api/v10/channels/" + CHANNEL_ID + "/messages", {
    method: "POST",
    headers: { "Authorization": "Bot " + DISCORD_BOT_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return Response.json({ error: "Discord API error", details: body }, { status: 502, headers: corsHeaders });
  return Response.json({ success: true, message_id: body.id, channel_id: CHANNEL_ID, participants: count ?? 0 }, { headers: corsHeaders });
});
