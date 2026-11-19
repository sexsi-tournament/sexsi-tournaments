import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fromHex(value: string): Uint8Array | null {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function ephemeral(content: string, linkUrl?: string) {
  const data: Record<string, unknown> = { content, flags: 64 };
  if (linkUrl) {
    data.components = [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: "СВЪРЖИ DISCORD",
        url: linkUrl,
      }],
    }];
  }
  return { type: 4, data };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const publicKeyHex = Deno.env.get("DISCORD_PUBLIC_KEY");
  const signatureHex = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  if (!publicKeyHex || !signatureHex || !timestamp) return json({ error: "Missing Discord signature headers or public key configuration" }, 401);

  const publicKey = fromHex(publicKeyHex);
  const signature = fromHex(signatureHex);
  if (!publicKey || publicKey.length !== 32 || !signature || signature.length !== 64) {
    return json({ error: "Invalid signature format" }, 401);
  }
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return json({ error: "Expired request" }, 401);
  }

  const body = await req.text();
  try {
    const key = await crypto.subtle.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      "Ed25519", key, signature, new TextEncoder().encode(timestamp + body)
    );
    if (!valid) return json({ error: "Invalid request signature" }, 401);
  } catch (error) {
    console.error("Discord signature verification failed:", error);
    return json({ error: "Signature verification unavailable" }, 500);
  }

  let interaction: any;
  try { interaction = JSON.parse(body); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  if (interaction.type === 1) return json({ type: 1 });

  if (interaction.type === 3) {
    const customId = String(interaction.data?.custom_id ?? "");
    const match = customId.match(/^sexsi_signup:([0-9a-f-]{36})$/i);
    if (!match) return json(ephemeral("Този бутон не е разпознат. Отвори актуалната публикация за турнира."));

    const discordUserId = String(interaction.member?.user?.id ?? interaction.user?.id ?? "");
    if (!discordUserId) return json(ephemeral("Не успях да разпозная Discord профила ти."));

    const { data, error } = await db.rpc("discord_register_for_tournament", {
      p_tournament_id: match[1],
      p_discord_user_id: discordUserId,
    });
    if (error) {
      console.error("Tournament registration RPC failed:", error);
      return json(ephemeral("Възникна техническа грешка при записването. Опитай отново след малко."));
    }

    const result = String(data);
    if (result === "discord_not_linked") {
      return json(ephemeral(
        "🔗 Discord акаунтът ти още не е свързан със SEXSI профил. Отвори профила си, влез в акаунта си, натисни „СВЪРЖИ DISCORD“ и разреши достъпа. След успешното свързване се върни тук и натисни „ЗАПИШИ СЕ“ отново.",
        "https://sexsi-tournament.github.io/sexsi-tournaments/profile.html#discordLinkCard"
      ));
    }

    const messages: Record<string, string> = {
      registered: "✅ Успешно се записа за турнира! Провери профила си в SEXSI TOURNAMENTS.",
      already_registered: "ℹ️ Вече си записан за този турнир.",
      blocked: "⛔ Нямаш право да се записваш за турнири в момента. Свържи се с екипа.",
      closed: "🔒 Регистрацията за този турнир не е отворена.",
      deadline_passed: "⌛ Срокът за записване е изтекъл.",
      missing_player_id: "⚠️ Добави своя Standoff 2 Player ID в профила си в сайта, преди да се запишеш.",
      full: "🚫 Всички места за този турнир са заети.",
      invalid_discord_user: "Не успях да разпозная Discord профила ти.",
    };
    return json(ephemeral(messages[result] ?? "Неуспешна регистрация. Свържи се с екипа."));
  }

  return json({ error: "Unsupported interaction" }, 400);
});
