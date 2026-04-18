// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log(`[Function Start]: seed-creator - Mode: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { username, password, full_name } = await req.json();
    console.log(`[Processing Request]: Seeding creator user ${username}`);

    if (!username || !password || !full_name) {
      console.warn(`[Validation Error]: Missing required fields for seeding`);
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate internal email from username (ASCII-safe)
    const safeSlug = username.toLowerCase().replace(/[^a-z0-9]/g, "") || `user${Date.now()}`;
    const email = `${safeSlug}@tikshov.internal`;

    // Create the initial creator user
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr) {
      console.error(`[Auth Error]: Failed to create core user ${username}: ${createErr.message}`);
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ full_name, role: "creator", must_change_password: false, username })
      .eq("id", userData.user.id);

    if (profileErr) {
       console.error(`[Database Error]: Failed to update profile for seeded user: ${profileErr.message}`);
    }

    // Add creator role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userData.user.id, role: "creator" });

    if (roleErr) {
       console.error(`[Database Error]: Failed to assign creator role: ${roleErr.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Function End]: seed-creator success - Duration: ${duration}ms - User ID: ${userData.user.id}`);

    return new Response(JSON.stringify({ success: true, user_id: userData.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[Function Error]: seed-creator failure - Duration: ${duration}ms`, err);

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
