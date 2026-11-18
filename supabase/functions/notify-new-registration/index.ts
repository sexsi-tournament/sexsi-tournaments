import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9.0.6";

const ADMIN_USER_ID = "13f1ada8-cd05-4c31-8940-4fb1790cb90e";

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gmailUser = Deno.env.get("GMAIL_SMTP_USER");
    const gmailPassword = Deno.env.get("GMAIL_SMTP_APP_PASSWORD");
    const fromName = Deno.env.get("GMAIL_FROM_NAME") ?? "SEXSI TOURNAMENTS";

    if (!supabaseUrl || !serviceKey || !gmailUser || !gmailPassword) {
      return reply({ error: "Missing required Supabase or Gmail SMTP secrets" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: hookToken, error: hookTokenError } = await admin.rpc("sexsi_get_match_hook_token");
    if (hookTokenError || typeof hookToken !== "string" || !hookToken) {
      return reply({ error: "Hook authentication is not configured" }, 500);
    }
    if (req.headers.get("x-sexsi-hook-token") !== hookToken) {
      return reply({ error: "Unauthorized" }, 401);
    }

    const payload = await req.json();
    const record = payload?.record;
    if (!record || typeof record.user_id !== "string" || typeof record.tournament_id !== "string") {
      return reply({ error: "Invalid registration record" }, 400);
    }

    const [{ data: userData, error: userError }, { data: profile, error: profileError }, { data: adminData, error: adminError }] =
      await Promise.all([
        admin.auth.admin.getUserById(record.user_id),
        admin.from("profiles").select("username,player_id").eq("id", record.user_id).maybeSingle(),
        admin.auth.admin.getUserById(ADMIN_USER_ID),
      ]);

    if (userError) throw userError;
    if (profileError) throw profileError;
    if (adminError) throw adminError;
    const adminEmail = adminData.user?.email?.trim();
    if (!adminEmail) return reply({ error: "Administrator account has no email address" }, 500);

    const username = profile?.username?.trim() || "Играч";
    const playerId = profile?.player_id?.trim() || "Не е посочено";
    const createdAt = record.created_at
      ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" }).format(new Date(record.created_at))
      : "Неизвестно";

    const subject = "Нова регистрация за SEXSI TOURNAMENTS";
    const message =
      "Има нова регистрация за турнир.\n\n" +
      "Играч: " + username + "\n" +
      "Standoff 2 Game ID: " + playerId + "\n" +
      "Турнир: " + record.tournament_id + "\n" +
      "Дата на регистрация: " + createdAt + "\n\n" +
      "Провери административния панел на SEXSI TOURNAMENTS.";

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPassword.replace(/\s+/g, "") },
    });

    try {
      const info = await transporter.sendMail({
        from: { name: fromName, address: gmailUser },
        to: adminEmail,
        subject,
        text: message,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</div>`,
      });
      return reply({ success: true, message_id: info.messageId ?? null });
    } finally {
      transporter.close();
    }
  } catch (error) {
    console.error("notify-new-registration error:", error);
    return reply({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});