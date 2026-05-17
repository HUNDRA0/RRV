// Unified login modal — replaces the old AdminLoginModal.
//
// Three tabs:
//   - Logga in     (username + password) — with a small "Admin?" toggle that swaps
//                  to the password-only admin login.
//   - Skapa konto  (username + password + säkerhetsfråga + svar)
//   - Glömt        (username → server returns the question, then answer + new pw)
//
// On successful login the modal closes. The parent decides what to do next
// (admin → open AdminConsole; user → stay on the page).

import { useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';

type Tab = 'login' | 'register' | 'recover';

const QUESTION_SUGGESTIONS = [
  'Vad heter min första katt/hund?',
  'I vilken stad föddes jag?',
  'Vad heter min favoritlärare?',
  'Vilken är min favoritmaträtt?',
  'Vad var mitt smeknamn som barn?',
];

interface LoginModalProps {
  onClose: () => void;
}

export function LoginModal({ onClose }: LoginModalProps) {
  const {
    loginUser, registerUser, recoverStart, recoverFinish, userAuthError,
    tryLogin, loginError,
  } = useFriendsList();

  const [tab, setTab] = useState<Tab>('login');
  const [adminMode, setAdminMode] = useState(false);

  useLockBody(true);
  useEsc(onClose, true);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal login-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Login"
      >
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>

        <div className="modal-info" style={{ padding: '32px 32px 28px' }}>
          <div className="section-eyebrow">Konto</div>
          <h2 className="modal-name" style={{ fontSize: 30, marginBottom: 18 }}>
            <em style={{ fontStyle: 'italic' }}>Logga in</em> eller skapa konto
          </h2>

          <div className="login-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'login'}
              className={tab === 'login' ? 'active' : ''}
              onClick={() => { setTab('login'); setAdminMode(false); }}
            >Logga in</button>
            <button
              role="tab"
              aria-selected={tab === 'register'}
              className={tab === 'register' ? 'active' : ''}
              onClick={() => { setTab('register'); setAdminMode(false); }}
            >Skapa konto</button>
            <button
              role="tab"
              aria-selected={tab === 'recover'}
              className={tab === 'recover' ? 'active' : ''}
              onClick={() => { setTab('recover'); setAdminMode(false); }}
            >Glömt lösenord</button>
          </div>

          {tab === 'login' && !adminMode && (
            <LoginForm
              onSubmit={async (input) => {
                const ok = await loginUser(input);
                if (ok) onClose();
              }}
              error={userAuthError}
              onAdmin={() => setAdminMode(true)}
            />
          )}
          {tab === 'login' && adminMode && (
            <AdminForm
              onSubmit={async (pw) => {
                const ok = await tryLogin(pw);
                if (ok) onClose();
              }}
              error={loginError}
              onBack={() => setAdminMode(false)}
            />
          )}
          {tab === 'register' && (
            <RegisterForm
              onSubmit={async (input) => {
                const ok = await registerUser(input);
                if (ok) onClose();
              }}
              error={userAuthError}
            />
          )}
          {tab === 'recover' && (
            <RecoverForm
              onStart={recoverStart}
              onFinish={async (input) => {
                const ok = await recoverFinish(input);
                if (ok) onClose();
              }}
              error={userAuthError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-forms ─────────────────────────────────────────────────────────

function LoginForm({
  onSubmit, error, onAdmin,
}: {
  onSubmit: (input: { username: string; password: string }) => Promise<void>;
  error: string | null;
  onAdmin: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSubmit({ username, password });
    setBusy(false);
  }

  return (
    <form onSubmit={handle} className="login-form">
      <label className="admin-field">
        <span>Användarnamn</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
      </label>
      <label className="admin-field">
        <span>Lösenord</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </label>
      {error && <div className="login-error">{error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy || !username || !password}>
          {busy ? 'Loggar in…' : 'Logga in'}
        </button>
      </div>
      <button type="button" className="login-link" onClick={onAdmin}>
        Logga in som admin →
      </button>
    </form>
  );
}

function AdminForm({
  onSubmit, error, onBack,
}: {
  onSubmit: (pw: string) => Promise<void>;
  error: string | null;
  onBack: () => void;
}) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSubmit(pw);
    setBusy(false);
  }
  return (
    <form onSubmit={handle} className="login-form">
      <div className="section-eyebrow" style={{ marginTop: 6 }}>Admin</div>
      <label className="admin-field">
        <span>Admin-lösenord</span>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
      </label>
      {error && <div className="login-error">{error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy || !pw}>
          {busy ? 'Loggar in…' : 'Logga in'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>Tillbaka</button>
      </div>
    </form>
  );
}

function RegisterForm({
  onSubmit, error,
}: {
  onSubmit: (input: { username: string; password: string; securityQuestion: string; securityAnswer: string }) => Promise<void>;
  error: string | null;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [questionChoice, setQuestionChoice] = useState(QUESTION_SUGGESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const usingCustom = questionChoice === '__custom__';
  const question = usingCustom ? customQuestion.trim() : questionChoice;

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSubmit({ username, password, securityQuestion: question, securityAnswer: answer });
    setBusy(false);
  }

  const valid = username.length >= 2 && password.length >= 6 && question.length >= 4 && answer.trim().length >= 1;

  return (
    <form onSubmit={handle} className="login-form">
      <label className="admin-field">
        <span>Användarnamn</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
      </label>
      <label className="admin-field">
        <span>Lösenord (minst 6 tecken)</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </label>
      <label className="admin-field">
        <span>Säkerhetsfråga</span>
        <select value={questionChoice} onChange={(e) => setQuestionChoice(e.target.value)}>
          {QUESTION_SUGGESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          <option value="__custom__">Egen fråga…</option>
        </select>
      </label>
      {usingCustom && (
        <label className="admin-field">
          <span>Din egen fråga</span>
          <input value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} />
        </label>
      )}
      <label className="admin-field">
        <span>Svar på säkerhetsfrågan</span>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </label>
      <div className="login-hint">
        Svaret används om du glömmer ditt lösenord. Stora/små bokstäver och mellanslag spelar ingen roll.
      </div>
      {error && <div className="login-error">{error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy || !valid}>
          {busy ? 'Skapar konto…' : 'Skapa konto'}
        </button>
      </div>
    </form>
  );
}

function RecoverForm({
  onStart, onFinish, error,
}: {
  onStart: (username: string) => Promise<string | null>;
  onFinish: (input: { username: string; securityAnswer: string; newPassword: string }) => Promise<void>;
  error: string | null;
}) {
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const q = await onStart(username);
    setBusy(false);
    if (q) setQuestion(q);
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onFinish({ username, securityAnswer: answer, newPassword });
    setBusy(false);
  }

  if (!question) {
    return (
      <form onSubmit={handleStart} className="login-form">
        <label className="admin-field">
          <span>Användarnamn</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        {error && <div className="login-error">{error}</div>}
        <div className="modal-photo-controls">
          <button type="submit" className="btn btn-purple" disabled={busy || !username}>
            {busy ? 'Hämtar…' : 'Hämta säkerhetsfråga'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleFinish} className="login-form">
      <div className="login-question-display">
        <span className="section-eyebrow">Säkerhetsfråga</span>
        <p>{question}</p>
      </div>
      <label className="admin-field">
        <span>Ditt svar</span>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus />
      </label>
      <label className="admin-field">
        <span>Nytt lösenord (minst 6 tecken)</span>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
      </label>
      {error && <div className="login-error">{error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy || !answer || newPassword.length < 6}>
          {busy ? 'Sätter…' : 'Sätt nytt lösenord'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setQuestion(null)}>Tillbaka</button>
      </div>
    </form>
  );
}
