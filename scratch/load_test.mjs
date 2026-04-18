import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Extremely lightweight polyfill to rip secrets generically 
const envVars = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8")
    .split("\n")
    .map(line => line.trim().split("="))
    .filter(parts => parts.length >= 2)
    .reduce((acc, [k, ...v]) => ({ ...acc, [k]: v.join("=").replace(/^"|"$/g, '') }), {});

const SUPABASE_URL = envVars["VITE_SUPABASE_URL"];
const SUPABASE_KEY = envVars["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE env vars.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runLoadTest(concurrency = 20) {
    console.log(`Firing ${concurrency} simultaneous atomic RPC payloads to Supabase...`);
    const tasks = Array.from({ length: concurrency }).map((_, i) => {
        const ticketId = `TK-SIM-${Math.floor(1000 + Math.random() * 9000)}-${i}`;
        return supabase.rpc("submit_ticket_atomic", {
            p_ticket_number: ticketId,
            p_full_name: `SimUser ${i}`,
            p_id_number: `12${Math.floor(1000000 + Math.random() * 8000000)}`,
            p_phone: `050${Math.floor(1000000 + Math.random() * 8000000)}`,
            p_description: "Massive concurrent simulation burst."
        }).then(res => {
            if (res.error) {
                console.error(`❌ [${ticketId}] Failed:`, res.error.message);
                return { success: false, error: res.error.message };
            }
            console.log(`✅ [${ticketId}] Inserted Atomically!`);
            return { success: true };
        });
    });

    const results = await Promise.all(tasks);
    const successCount = results.filter(r => r.success).length;
    console.log(`\n============ LOAD TEST SUMMARY ============`);
    console.log(`Total Handled: ${concurrency}`);
    console.log(`Passed: ${successCount} / Failed: ${concurrency - successCount}`);
    
    // Explicit shutdown so script doesn't hang gracefully
    if (successCount === concurrency) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runLoadTest();
