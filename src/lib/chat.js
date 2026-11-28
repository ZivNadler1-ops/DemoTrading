import { supabase } from './supabase';

export async function loadMessages(symbol) {
  let query = supabase
    .from('chat_messages')
    .select('id, symbol, role, content, created_at')
    .order('created_at', { ascending: true })
    .limit(200);
  if (symbol) query = query.eq('symbol', symbol);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function sendQuestion({ symbol, question, price, changePct }) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ symbol, question, price, changePct }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'שגיאה');
  return json.answer;
}