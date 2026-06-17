const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if credentials exist and look like real values (not placeholders)
const hasValidCredentials = 
  supabaseUrl && 
  supabaseServiceKey && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('your_supabase_project_url');

if (!hasValidCredentials) {
  console.warn('⚠️  Supabase credentials not set or using placeholders. Using mock mode for development.');
}

const supabase = hasValidCredentials
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

module.exports = { supabase };
