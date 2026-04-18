import { createClient } from "@supabase/supabase-js";

const supabase = createClient("https://gihxighhmmrvyvbtnrxy.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaHhpZ2hobW1ydnl2YnRucnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjgwNzIsImV4cCI6MjA4OTE0NDA3Mn0.Jj1HgYFgfXlYh_Ttfge6z-Nmr5_ZcDgp5cgdKrBLi_c");

async function check() {
  const username = "אילאיל שוסטר 2";
  console.log("Calling seed-creator...");
  const body = { username: username, password: "testtest123", full_name: username };
  const res = await fetch("https://gihxighhmmrvyvbtnrxy.supabase.co/functions/v1/seed-creator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log("seed-creator res:", res.status, text);

  const { data: email } = await supabase.rpc("get_email_by_username", { p_username: username });
  console.log("Email from RPC:", email);
  if (email) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: "testtest123" });
    console.log("LOGIN:", data.session ? "Success" : "Failed", error?.message);
  }
}
check();