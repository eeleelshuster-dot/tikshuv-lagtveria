import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envVars = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8")
    .split("\n")
    .map(line => line.trim().split("="))
    .filter(parts => parts.length >= 2)
    .reduce((acc, [k, ...v]) => ({ ...acc, [k]: v.join("=").replace(/^"|"$/g, '') }), {});

const SUPABASE_URL = envVars["VITE_SUPABASE_URL"] || envVars["SUPABASE_URL"];
const SUPABASE_KEY = envVars["SUPABASE_SERVICE_ROLE_KEY"]; // Need admin privileges for wipe and view

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing SUPABASE env vars.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkFailures() {
    console.log("=== CHECKING FAILED NOTIFICATIONS ===");
    const { data, error } = await supabase.from("failed_notifications").select("*").order("created_at", { ascending: false }).limit(5);
    if (error) {
        console.error("Failed to query notifications (did you run the migration?):", error.message);
    } else {
        console.log("Last 5 Failed Notifications:", JSON.stringify(data, null, 2));
    }
}

async function wipeTickets() {
    console.log("\n=== WIPING ALL TICKETS ===");
    // To wipe all tickets and cascade, we delete from tickets where id is not null
    const { count, error } = await supabase.from("tickets")
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Drop everything
    
    if (error) {
        console.error("Fail to wipe tickets:", error.message);
    } else {
        console.log(`Successfully deleted ${count} tickets and all associated cascades!`);
    }
}

async function run() {
    await checkFailures();
    await wipeTickets();
}

run();
