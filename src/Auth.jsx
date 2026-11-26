import { useState } from 'react';
import { supabase } from './lib/supabase';

const ERRORS = {
  'Invalid login credentials': 'אימייל או סיסמה לא נכונים',
  'User already registered': 'כתובת המייל כבר רשומה. נסה להיכנס',
  'Password should be at least 6 characters.': 'הסיסמה חייבת להכיל לפחות 6 תווים',
  'Email not confirmed': 'יש לאשר את המייל לפני הכניסה',
  'Email rate limit exceeded': 'נשלחו יותר מדי מיילים. נסה שוב מאוחר יותר',
};

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (result.error) {
      setIsError(true);
      setMessage(ERRORS[result.error.message] || result.error.message);
      return;
    }

    // הרשמה שדורשת אישור מייל: אין כניסה אוטומטית
    if (mode === 'signup' && !result.data.session) {
      setIsError(false);
      setMessage('נשלח אליך מייל לאישור. לחץ על הקישור שבמייל, ואז חזור והיכנס.');
    }
  }

  return (
    <div dir="rtl" className="auth">
      <form className="auth-box" onSubmit={submit}>
        <h1>{mode === 'login' ? 'כניסה' : 'הרשמה'}</h1>

        <input
          type="email"
          placeholder="אימייל"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="pw">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="סיסמה (לפחות 6 תווים)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="button"
            className="eye"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'רגע...' : mode === 'login' ? 'כניסה' : 'הרשמה'}
        </button>

        {message && <p className={isError ? 'msg error' : 'msg ok'}>{message}</p>}

        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setMessage('');
          }}
        >
          {mode === 'login' ? 'אין לך חשבון? הירשם' : 'יש לך חשבון? היכנס'}
        </button>
      </form>
    </div>
  );
}