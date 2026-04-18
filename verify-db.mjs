import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const processEnv = Object.fromEntries(
  envText.split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => {
      const [key, ...value] = line.split('=');
      return [key.trim(), value.join('=').trim().replace(/^"(.*)"$/, '$1')];
    })
);

const supabase = createClient(processEnv.SUPABASE_URL, processEnv.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', 'אילאיל שוסטר')
    .single();

  const { data: roles, error: rErr } = await supabase
    .from('user_roles')
    .select('*');

  console.log('Profile:', profile);
  console.log('Profile Error:', pErr?.message);
  console.log('All Roles:', roles);
  console.log('Roles Error:', rErr?.message);
}

check();
