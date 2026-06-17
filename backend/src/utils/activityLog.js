const { supabase } = require('../config/supabase');

// In-memory log fallback for demo (when Supabase not configured)
const inMemoryLogs = [];

async function logActivity(userId, action, details = {}, ipAddress = null) {
  const entry = {
    user_id: userId,
    action,
    details: JSON.stringify(details),
    ip_address: ipAddress,
    created_at: new Date().toISOString(),
  };

  if (supabase) {
    const { error } = await supabase.from('activity_logs').insert(entry);
    if (error) {
      console.error('Activity log error:', error.message);
      inMemoryLogs.push(entry);
    }
  } else {
    inMemoryLogs.push(entry);
  }
}

async function getActivityLogs(userId = null, limit = 50) {
  if (supabase) {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) query = query.eq('user_id', userId);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // In-memory fallback
  let logs = [...inMemoryLogs].reverse();
  if (userId) logs = logs.filter(l => l.user_id === userId);
  return logs.slice(0, limit);
}

module.exports = { logActivity, getActivityLogs };
