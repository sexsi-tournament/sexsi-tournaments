import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9.0.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-sexsi-hook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const payload = await req.json();
    const matchId = typeof payload.match_id === "string" ? payload.match_id : "";
    if (!matchId) return reply({ error: "match_id is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gmailUser = Deno.env.get("GMAIL_SMTP_USER");
    const gmailPassword = Deno.env.get("GMAIL_SMTP_APP_PASSWORD");
    const fromName = Deno.env.get("GMAIL_FROM_NAME") ?? "SEXSI TOURNAMENTS";
    if (!supabaseUrl || !serviceKey || !gmailUser || !gmailPassword) return reply({ error: "Missing required Supabase or Gmail SMTP secrets" }, 500);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: hookToken, error: hookTokenError } = await admin.rpc("sexsi_get_match_hook_token");
    if (hookTokenError || typeof hookToken !== "string" || !hookToken) {
      return reply({ error: "Hook authentication is not configured" }, 500);
    }
    if (req.headers.get("x-sexsi-hook-token") !== hookToken) {
      return reply({ error: "Unauthorized" }, 401);
    }
    const { data: match, error: matchError } = await admin.from("matches")
      .select("id, match_number, round_number, scheduled_at, player1_id, player2_id, tournament_id")
      .eq("id", matchId).maybeSingle();
    if (matchError) throw matchError;
    if (!match || !match.scheduled_at || !match.player1_id || !match.player2_id) return reply({ error: "Match is missing, unscheduled, or has incomplete players" }, 404);

    const { data: tournament, error: tournamentError } = await admin.from("tournaments")
      .select("name").eq("id", match.tournament_id).maybeSingle();
    if (tournamentError) throw tournamentError;

    const claim = await admin.from("matches")
      .update({ schedule_email_status: "sending", schedule_email_error: null })
      .eq("id", matchId).in("schedule_email_status", ["not_sent", "failed"])
      .select("id, schedule_email_sent_to").maybeSingle();
    if (claim.error) throw claim.error;
    if (!claim.data) {
      const { data: current } = await admin.from("matches")
        .select("schedule_email_status, schedule_email_sent_to").eq("id", matchId).maybeSingle();
      return reply({ skipped: true, status: current?.schedule_email_status ?? "unknown", sent_to_count: current?.schedule_email_sent_to?.length ?? 0 });
    }

    const sentTo: string[] = [...(claim.data.schedule_email_sent_to ?? [])];
    const players = [{ id: match.player1_id, opponentId: match.player2_id }, { id: match.player2_id, opponentId: match.player1_id }];
    const users = new Map<string, { email: string; username: string }>();
    for (const player of players) {
      const { data: profile, error: profileError } = await admin.from("profiles").select("username").eq("id", player.id).maybeSingle();
      if (profileError) throw profileError;
      const { data: authData, error: authError } = await admin.auth.admin.getUserById(player.id);
      if (authError) throw authError;
      const email = authData.user?.email?.trim().toLowerCase();
      if (!email) throw new Error("A player account has no email address");
      users.set(player.id, { email, username: profile?.username ?? "участник" });
    }

    const date = new Date(match.scheduled_at);
    const dateText = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", day: "numeric", month: "long", year: "numeric" }).format(date);
    const timeText = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: gmailUser, pass: gmailPassword.replace(/\s+/g, "") },
    });
    const results: { email: string; ok: boolean; error?: string }[] = [];
    try {
      for (const player of players) {
        const recipient = users.get(player.id)!;
        if (sentTo.includes(recipient.email)) continue;
        const opponent = users.get(player.opponentId)!;
        const subject = `Насрочен двубой №${match.match_number} | SEXSI 1V1 CUP #001`;
        const message =
          `Здравейте, ${recipient.username}!\n\n` +
          `Вашият двубой от ${tournament?.name ?? "SEXSI 1V1 CUP #001"} е насрочен.\n\n` +
          `Двубой: №${match.match_number}\nПротивник: ${opponent.username}\nДата: ${dateText}\nЧас: ${timeText} ч. (българско време)\nФормат: BO1 (една игра)\n\n` +
          `Моля, бъдете готови и се свържете своевременно с противника си за организацията на двубоя.\n\nПоздрави,\nЕкипът на SEXSI TOURNAMENTS`;
        try {
          await transporter.sendMail({
            from: { name: fromName, address: gmailUser }, to: recipient.email, subject, text: message,
            html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</div>`,
          });
          sentTo.push(recipient.email);
          const saveProgress = await admin.from("matches").update({ schedule_email_sent_to: sentTo }).eq("id", matchId);
          if (saveProgress.error) throw saveProgress.error;
          results.push({ email: recipient.email, ok: true });
        } catch (error) {
          results.push({ email: recipient.email, ok: false, error: error instanceof Error ? error.message : String(error) });
          break;
        }
      }
    } finally {
      transporter.close();
    }
    const failed = results.find((result) => !result.ok);
    const finalStatus = failed ? "failed" : sentTo.length >= 2 ? "sent" : "failed";
    const { error: finishError } = await admin.from("matches").update({
      schedule_email_status: finalStatus,
      schedule_email_sent_at: finalStatus === "sent" ? new Date().toISOString() : null,
      schedule_email_error: failed?.error ?? (finalStatus === "sent" ? null : "One or more recipient emails remain unsent"),
    }).eq("id", matchId);
    if (finishError) throw finishError;
    return reply({ match_id: matchId, status: finalStatus, sent_this_run: results.filter((r) => r.ok).length, total_sent: sentTo.length, failed: failed ? { email: failed.email, error: failed.error } : null, scheduled_date: dateText, scheduled_time: timeText });
  } catch (error) {
    console.error("notify-match-scheduled error:", error);
    return reply({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});