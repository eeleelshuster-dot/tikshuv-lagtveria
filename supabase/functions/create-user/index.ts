// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // 1. Bulletproof CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[Function Start]: create-user - Mode: ${req.method}`);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 2. Safe Body Parsing
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.warn("[Validation Error]: Could not parse request body");
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { username, password, full_name, role } = body;
    console.log(`[Processing Request]: Creating user ${username} with role ${role}`);

    if (!username || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: username, password, full_name, role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Robust Authorization Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[Security Error]: No Authorization header provided");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      console.error(`[Security Error]: Failed to verify caller: ${authErr?.message}`);
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check creator permission in profiles
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profileErr || profile?.role !== "creator") {
      console.error(`[Security Error]: User ${caller.id} (role: ${profile?.role}) attempted creator task`);
      return new Response(JSON.stringify({ error: "Forbidden: Creator permissions required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. ASCII-Safe Email Generation
    const safeUsername = username
      .toLowerCase()
      .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII
      .replace(/\s+/g, "");
    
    const emailPrefix = safeUsername || "user";
    const email = `${emailPrefix}_${Math.random().toString(36).substring(2, 7)}@tikshov.local`;

    console.log(`[Function]: Creating auth user with email: ${email} for user: ${username}`);

    // 5. Create Auth User
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr) {
      console.error(`[Auth Error]: Failed to create user: ${createErr.message}`);
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Database Updates (Profile & Roles)
    const { error: profileUpdateErr } = await supabaseAdmin
      .from("profiles")
      .update({ full_name, role, must_change_password: true, username })
      .eq("id", userData.user.id);

    if (profileUpdateErr) {
        console.error(`[Database Error]: Failed profile update for ${userData.user.id}: ${profileUpdateErr.message}`);
    }

    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userData.user.id, role });

    if (roleInsertErr) {
        console.error(`[Database Error]: Failed to assign role ${role} to ${userData.user.id}: ${roleInsertErr.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Function Success]: create-user finished in ${duration}ms - User ID: ${userData.user.id}`);

    return new Response(JSON.stringify({ user_id: userData.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error(`[Critical Failure]: create-user internal error`, err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
