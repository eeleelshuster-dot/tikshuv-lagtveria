// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  // 1. Bulletproof CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[Function Start]: delete-user - Mode: ${req.method}`);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Safe Body Parsing
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = body;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Robust Authorization Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check creator role in profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profile?.role !== "creator") {
      return new Response(JSON.stringify({ error: "Forbidden: Creator access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Delete user
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteErr) {
      console.error(`[Auth Error]: Failed to delete user ${userId}: ${deleteErr.message}`);
      return new Response(JSON.stringify({ error: deleteErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Function Success]: delete-user finished in ${duration}ms`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[Critical Failure]: delete-user internal error`, err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
