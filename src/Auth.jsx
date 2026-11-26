import { useState } from 'react';
import { supabase } from './lib/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    const action =
      mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await action;
    if (error) setMessage(error.message);
  }

  return (
    <div dir="rtl" className="auth">
      <form className="auth-box" onSubmit={submit}>
        <h1>{mode === 'login' ? 'כניסה' : 'הרשמה'}</h1>
        <input type="email" placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button type="submit">{mode === 'login' ? 'כניסה' : 'הרשמה'}</button>
        {message && <p className="error">{message}</p>}
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'אין לך חשבון? הירשם' : 'יש לך חשבון? היכנס'}
        </button>
      </form>
    </div>
  );
}