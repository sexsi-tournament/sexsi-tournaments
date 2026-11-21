import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9.0.6";

const TOURNAMENT_ID = "SEXSI-1V1-001";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

async function sendEmail(
  recipient: string,
  subject: string,
  message: string,
  config: { gmailUser: string; gmailPassword: string; fromName: string },
) {
  const html = `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</div>`;
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: config.gmailUser,
      pass: config.gmailPassword.replace(/\s+/g, ""),
    },
  });

  try {
    const info = await transporter.sendMail({
      from: { name: config.fromName, address: config.gmailUser },
      to: recipient,
      subject,
      text: message,
      html,
    });
    return { ok: true, detail: info.messageId ?? "Accepted by Gmail SMTP" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    transporter.close();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) return reply({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gmailUser = Deno.env.get("GMAIL_SMTP_USER");
    const gmailPassword = Deno.env.get("GMAIL_SMTP_APP_PASSWORD");
    const fromName = Deno.env.get("GMAIL_FROM_NAME") ?? "SEXSI TOURNAMENTS";
    const provider = "gmail";

    if (!supabaseUrl || !anonKey || !serviceKey || !gmailUser || !gmailPassword) {
      return reply({ error: "Missing required secrets. Configure Supabase URL/keys and Gmail SMTP secrets." }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    const { data: permitted, error: permissionError } = await authClient.rpc("sexsi_has_admin_permission", { p_permission: "send_emails" });
    if (authError || !userData.user || permissionError || permitted !== true) {
      return reply({ error: "Forbidden: administrator only" }, 403);
    }

    let payload: { subject?: unknown; message?: unknown; dry_run?: unknown; test_only?: unknown; recipient_user_id?: unknown };
    try {
      payload = await req.json();
    } catch {
      return reply({ error: "Invalid JSON body" }, 400);
    }

    const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const dryRun = payload.dry_run === true;
    const testOnly = payload.test_only === true;

    if (!subject || subject.length > 180) return reply({ error: "Subject is required and must be at most 180 characters." }, 400);
    if (!message || message.length > 10000) return reply({ error: "Message is required and must be at most 10000 characters." }, 400);

    const config = { gmailUser, gmailPassword, fromName };
    const testRecipient = userData.user?.email?.trim() ?? "";

    if (typeof payload.recipient_user_id === "string" && payload.recipient_user_id.trim()) {
      if (testOnly) return reply({ error: "Single-recipient and test modes cannot be combined." }, 400);
      const targetUserId = payload.recipient_user_id.trim();
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
      if (targetError || !targetData.user?.email) {
        return reply({ error: "The selected player has no valid registered email address." }, 404);
      }
      const recipient = targetData.user.email.trim();
      if (dryRun) {
        return reply({ dry_run: true, single_recipient: true, provider, recipients_count: 1, recipient, message: "Recipient verified. No email sent." });
      }
      const result = await sendEmail(recipient, subject, message, config);
      if (!result.ok) {
        return reply({ error: "Gmail SMTP delivery failed.", detail: result.detail, single_recipient: true, sent: 0, failed: 1, recipients_count: 1 }, 502);
      }
      return reply({ single_recipient: true, provider, sent: 1, failed: 0, recipients_count: 1, recipient, provider_response: result.detail, message: "Email accepted by Gmail SMTP." });
    }

    if (testOnly) {
      if (!testRecipient) return reply({ error: "Administrator account has no email address." }, 400);
      if (dryRun) {
        return reply({ dry_run: true, test_only: true, provider, recipients_count: 1, recipient: testRecipient, message: "Test preview only. No email sent." });
      }
      const result = await sendEmail(testRecipient, subject, message, config);
      if (!result.ok) {
        return reply({ error: "Gmail SMTP test failed.", detail: result.detail, provider, sent: 0, failed: 1, recipients_count: 1 }, 502);
      }
      return reply({ test_only: true, provider, sent: 1, failed: 0, recipients_count: 1, recipient: testRecipient, provider_response: result.detail, message: `Test email accepted by ${provider}.` });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: registrations, error: registrationError } = await admin
      .from("tournament_registrations")
      .select("user_id")
      .eq("tournament_id", TOURNAMENT_ID);

    if (registrationError) throw registrationError;
    if (!registrations?.length) return reply({ error: "No registrations found for this tournament." }, 404);

    const userIds = [...new Set(registrations.map((row) => row.user_id).filter(Boolean))];
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw usersError;

    const userMap = new Map(usersData.users.map((user) => [user.id, user]));
    const recipients = userIds
      .map((id) => userMap.get(id)?.email?.trim())
      .filter((email): email is string => Boolean(email));

    const uniqueRecipients = [...new Set(recipients.map((email) => email.toLowerCase()))];
    if (uniqueRecipients.length !== userIds.length) {
      return reply({
        error: "Recipient validation failed. At least one registered player has no email or duplicate email.",
        registered_players: userIds.length,
        valid_unique_emails: uniqueRecipients.length,
      }, 409);
    }

    if (dryRun) {
      return reply({
        dry_run: true,
        provider,
        tournament_id: TOURNAMENT_ID,
        recipients_count: uniqueRecipients.length,
        message: "Preview only. No emails were sent.",
      });
    }

    const results: { email: string; ok: boolean; detail?: string }[] = [];
    for (const email of uniqueRecipients) {
      const result = await sendEmail(email, subject, message, config);
      results.push({ email, ok: result.ok, detail: result.ok ? undefined : result.detail });
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const sent = results.filter((result) => result.ok).length;
    const failed = results.filter((result) => !result.ok);
    return reply({
      provider,
      tournament_id: TOURNAMENT_ID,
      recipients_count: uniqueRecipients.length,
      sent,
      failed: failed.length,
      failures: failed,
    });
  } catch (error) {
    console.error("send-tournament-emails error:", error);
    return reply({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});