import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupAndSeed() {
  console.log('--- Starting User Cleanup ---');
  
  // 1. Fetch all users
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }
  
  console.log(`Found ${users.length} users to delete.`);
  
  // 2. Delete all users
  for (const user of users) {
    console.log(`Deleting user: ${user.email} (${user.id})`);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(`Failed to delete ${user.id}:`, deleteError.message);
    }
  }
  
  console.log('Cleanup completed. Waiting 3 seconds before seeding...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 3. Trigger seed-creator function
  console.log('--- Triggering seed-creator ---');
  const functionUrl = `${supabaseUrl}/functions/v1/seed-creator`;
  
  const payload = {
    username: 'eeleel shuster',
    password: 'Eeleel1810',
    full_name: 'Eeleel Shuster',
    must_change_password: false
  };
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Seed successful:', result);
    } else {
      console.error('Seed failed:', result);
    }
  } catch (err) {
    console.error('Network error calling seed-creator:', err.message);
  }
  
  console.log('--- Operation Finished ---');
}

cleanupAndSeed();
