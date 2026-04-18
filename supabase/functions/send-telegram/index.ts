// @ts-nocheck
import { corsHeaders } from "../_shared/cors.ts";

/**
 * send-telegram Edge Function
 * Accepts: POST { message: string }
 * Uses TELEGRAM_API_KEY and TELEGRAM_CHAT_ID from Supabase secrets.
 * This is the single, authoritative function for sending Telegram messages.
 * All other functions that need to notify Telegram should call this one.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_API_KEY) {
      throw new Error("TELEGRAM_API_KEY secret is not configured");
    }
    if (!TELEGRAM_CHAT_ID) {
      throw new Error("TELEGRAM_CHAT_ID secret is not configured");
    }

    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "message field is required and must be a non-empty string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message.trim(),
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[send-telegram] Telegram API error ${response.status}:`, JSON.stringify(data));
      throw new Error(`Telegram API error [${response.status}]: ${data?.description ?? "Unknown"}`);
    }

    console.log(`[send-telegram] Message sent successfully. message_id=${data?.result?.message_id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-telegram] Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
