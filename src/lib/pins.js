import { supabase } from './supabase';

export async function loadPins() {
  const { data, error } = await supabase.from('chat_pins').select('symbol');
  if (error) throw error;
  return (data || []).map((r) => r.symbol);
}

export async function setPin(symbol, pinned) {
  if (pinned) {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) throw new Error('יש להתחבר');
    const { error } = await supabase.from('chat_pins').insert({ user_id: userId, symbol });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase.from('chat_pins').delete().eq('symbol', symbol);
    if (error) throw error;
  }
}