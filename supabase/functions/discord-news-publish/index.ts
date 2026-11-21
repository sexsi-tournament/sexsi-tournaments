import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const CHANNEL_ID = "1573001140419821588";
const SITE_URL = "https://sexsi-tournament.github.io/sexsi-tournaments/news.html";
const db = createClient(SUPABASE_URL, SERVICE_ROLE);

const cache = new Map<string, string>();
async function translate(value: string): Promise<string> {
  const original = String(value ?? "").trim();
  if (!original || new TextEncoder().encode(original).length > 480) return original;
  if (cache.has(original)) return cache.get(original)!;
  try {
    const params = new URLSearchParams({ q: original, langpair: "bg|en", mt: "1" });
    const response = await fetch("https://api.mymemory.translated.net/get?" + params, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return original;
    const data = await response.json();
    const translated = String(data?.responseData?.translatedText ?? "").trim()
      .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    if (Number(data?.responseStatus) !== 200 || !translated || translated.toUpperCase().includes("MYMEMORY WARNING")) return original;
    if (cache.size > 250) cache.clear();
    cache.set(original, translated);
    return translated;
  } catch (error) {
    console.warn("News translation unavailable:", error);
    return original;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: {
    "Access-Control-Allow-Origin": "https://sexsi-tournament.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  }});
  const cors = { "Access-Control-Allow-Origin": "https://sexsi-tournament.github.io", "Content-Type": "application/json" };
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const { data: permitted, error: permissionError } = await authClient.rpc("sexsi_has_admin_permission", { p_permission: "manage_news" });
  if (authError || !authData.user || permissionError || permitted !== true) return Response.json({ error: "Forbidden" }, { status: 403, headers: cors });

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors }); }
  const id = String(body?.news_id ?? "");
  if (!id) return Response.json({ error: "Missing news_id" }, { status: 400, headers: cors });
  const { data: news, error } = await db.from("sexsi_news").select("id,title,summary,content,category,is_published,published_at,live_url").eq("id", id).single();
  if (error || !news) return Response.json({ error: "News not found" }, { status: 404, headers: cors });
  if (!news.is_published) return Response.json({ success: true, skipped: true, reason: "draft" }, { headers: cors });

  const [titleEn, categoryEn, summaryEn, contentEn] = await Promise.all([
    translate(news.title), translate(news.category || "НОВИНИ"),
    translate(news.summary || ""), translate(news.content)
  ]);
  const title = news.title.slice(0, 240);
  const summary = (news.summary || "").slice(0, 900);
  const content = news.content.slice(0, 2200);
  const enSummary = summaryEn !== news.summary ? summaryEn.slice(0, 900) : "";
  const enContent = contentEn !== news.content ? contentEn.slice(0, 2200) : "";
  const description = [
    summary ? summary : "",
    content,
    "━━━━━━━━━━━━━━━━━━━━",
    "🇬🇧 " + (categoryEn !== news.category ? categoryEn : "NEWS"),
    titleEn !== news.title ? "**" + titleEn.slice(0, 240) + "**" : "",
    enSummary,
    enContent
  ].filter(Boolean).join("\n\n").slice(0, 4000);
  let buttonUrl = SITE_URL;
  let buttonLabel = "ОТВОРИ НОВИНАТА / READ NEWS";
  const liveUrl = String(news.live_url || "").trim();
  if (liveUrl) {
    try {
      const parsed = new URL(liveUrl);
      const host = parsed.hostname.toLowerCase();
      if (parsed.protocol !== "https:" || !(host === "tiktok.com" || host.endsWith(".tiktok.com"))) {
        return Response.json({ error: "Invalid LIVE URL. Only HTTPS TikTok links are allowed." }, { status: 400, headers: cors });
      }
      buttonUrl = parsed.toString();
      buttonLabel = "🔴 ГЛЕДАЙ НА ЖИВО В TIKTOK";
    } catch {
      return Response.json({ error: "Invalid LIVE URL." }, { status: 400, headers: cors });
    }
  }
  const payload = {
    embeds: [{
      title: (liveUrl ? "🔴 LIVE · " : "📰 ") + title,
      url: SITE_URL,
      description,
      color: liveUrl ? 15548997 : 16766720,
      fields: [{ name: "🏷️ " + (news.category || "НОВИНИ") + (categoryEn !== news.category ? " / " + categoryEn : ""), value: "🇧🇬 Български · 🇬🇧 English", inline: true }],
      footer: { text: "SEXSI TOURNAMENTS · Официални новини" },
      timestamp: news.published_at || new Date().toISOString()
    }],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: buttonLabel, url: buttonUrl }] }]
  };
  const discord = await fetch("https://discord.com/api/v10/channels/" + CHANNEL_ID + "/messages", {
    method: "POST", headers: { Authorization: "Bot " + BOT_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  const result = await discord.json().catch(() => ({}));
  if (!discord.ok) {
    console.error("Discord news publish failed:", result);
    return Response.json({ error: "Discord API error", details: result }, { status: 502, headers: cors });
  }
  return Response.json({ success: true, message_id: result.id, channel_id: CHANNEL_ID }, { headers: cors });
});