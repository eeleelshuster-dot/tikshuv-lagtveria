// @ts-nocheck: Deno runtime types are not compatible with standard TypeScript definitions
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * notify-telegram Edge Function
 * Formats structured alert payloads into human-readable messages
 * and delegates the actual Telegram delivery to the `send-telegram` function.
 *
 * Accepted alert_types:
 *   - "ticket_creation" (default): { ticket_number, full_name, description }
 *   - "system_error": { component, error_message }
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log(`[notify-telegram] Start - Method: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let ticketNumber = "UNKNOWN";
  let payloadStr = "{}";

  try {
    const payload = await req.json();
    payloadStr = JSON.stringify(payload);
    ticketNumber = payload.ticket_number || "UNKNOWN";

    const alert_type = payload.alert_type || "ticket_creation";
    let message = "";

    if (alert_type === "ticket_creation") {
      const { ticket_number, full_name, description } = payload;
      console.log(`[notify-telegram] Ticket notification for ${ticket_number}`);
      message =
        `🎫 <b>פנייה חדשה!</b>\n\n` +
        `<b>מספר פנייה:</b> ${ticket_number}\n` +
        `<b>שם:</b> ${full_name}\n` +
        `<b>תיאור:</b> ${description || "ללא תיאור"}\n`;
    } else if (alert_type === "system_error") {
      const component = payload.component || "unknown";
      const error_msg = payload.error_message || "Unknown Error";
      console.log(`[notify-telegram] System error alert for component: ${component}`);
      message =
        `🚨 <b>שגיאת מערכת!</b>\n\n` +
        `<b>רכיב:</b> ${component}\n` +
        `<b>שגיאה:</b> ${error_msg}\n` +
        `<b>זמן:</b> ${new Date().toISOString()}\n`;
    } else {
      throw new Error(`Unsupported alert_type: ${alert_type}`);
    }

    // Delegate sending to the dedicated send-telegram function
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not configured");
    }

    const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ message }),
    });

    if (!sendResponse.ok) {
      const errData = await sendResponse.json().catch(() => ({}));
      throw new Error(`send-telegram returned ${sendResponse.status}: ${errData?.error ?? "Unknown"}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[notify-telegram] Success - Duration: ${duration}ms`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    // Type guard to safely access error properties
    const err = error instanceof Error ? error : new Error(String(error));
    // Now you can use err.message, err.stack, etc.
    const duration = Date.now() - startTime;
    const errorMessage = err.message;
    console.error(`[notify-telegram] Error after ${duration}ms:`, errorMessage);

    // Log failure to DB using service role so RLS doesn't block the write
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from("failed_notifications").insert({
          ticket_number: ticketNumber,
          error_message: errorMessage,
          payload: JSON.parse(payloadStr),
        });
      }
    } catch (dbErr) {
      console.error("[notify-telegram] Failed to write to failed_notifications:", dbErr);
    }

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
