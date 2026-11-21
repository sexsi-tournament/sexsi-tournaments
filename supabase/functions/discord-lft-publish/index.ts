import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const BOT = Deno.env.get("DISCORD_BOT_TOKEN")!;
const CHANNEL = "1572861480586444830";
const ORIGIN = "*";
const headers = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers});
  if (req.method !== "POST") return Response.json({error:"Method not allowed"},{status:405,headers});
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return Response.json({error:"Unauthorized"},{status:401,headers});
  const client = createClient(URL, ANON, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const {data,error} = await client.auth.getUser(token);
  const {data,error} = await client.auth.getUser(token);
  const {data:permitted,error:permissionError} = await client.rpc("sexsi_has_admin_permission",{p_permission:"publish_discord"});
  if (error || !data.user || permissionError || permitted !== true) return Response.json({error:"Forbidden"},{status:403,headers});
  const payload = {
    embeds: [{
      title: "🤝 НАМЕРИ СИ ОТБОР · SEXSI",
      description: "Търсиш отбор или имаш отбор и търсиш играчи за Standoff 2?\n\nИзбери подходящия бутон и попълни кратката форма. Обявата ти ще бъде публикувана автоматично тук.\n\n🎮 Игрово име и Player ID\n🏅 Ранг\n🎯 Какво търсиш\n💬 Връзка с теб чрез Discord",
      color: 15548997,
      footer: {text:"SEXSI TOURNAMENTS · LFG"}
    }],
    components: [{type:1,components:[
      {type:2,style:3,label:"ТЪРСЯ ОТБОР",custom_id:"sexsi_lft:team"},
      {type:2,style:1,label:"ТЪРСЯ ИГРАЧИ",custom_id:"sexsi_lft:players"}
    ]}]
  };
  const listResponse = await fetch("https://discord.com/api/v10/channels/"+CHANNEL+"/messages?limit=50", {
    headers: { Authorization: "Bot "+BOT }
  });
  const recent = listResponse.ok ? await listResponse.json().catch(()=>[]) : [];
  const existing = Array.isArray(recent) ? recent.find((m:any) =>
    m.author?.bot && m.embeds?.some((e:any) => e.title === "🤝 НАМЕРИ СИ ОТБОР · SEXSI")
  ) : null;
  const response = await fetch("https://discord.com/api/v10/channels/"+CHANNEL+"/messages"+(existing ? "/"+existing.id : ""),{
    method: existing ? "PATCH" : "POST",
    headers:{Authorization:"Bot "+BOT,"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok) return Response.json({error:"Discord API error",details:result},{status:502,headers});
  return Response.json({success:true,updated:Boolean(existing),channel_id:CHANNEL,message_id:result.id||existing?.id},{headers});
});