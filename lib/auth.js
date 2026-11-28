export const ADMIN_EMAIL = 'ziv.nadler1@gmail.com';

export async function getUserFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.VITE_SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export function isAdmin(user) {
  return (
    !!user &&
    typeof user.email === 'string' &&
    user.email.toLowerCase() === ADMIN_EMAIL &&
    !!user.email_confirmed_at
  );
}