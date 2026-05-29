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

import { useEffect, useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';
import { useFriendsList } from '../../lib/state';
import { isPlatformAuthenticatorAvailable } from '../../lib/passkey';

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
  initialTab?: Tab;
}

export function LoginModal({ onClose, initialTab = 'login' }: LoginModalProps) {
  const {
    loginUser, loginWithPasskey, signupWithPasskey, registerUser, recoverStart, recoverFinish, userAuthError,
    tryLogin, loginError,
  } = useFriendsList();

  const [tab, setTab] = useState<Tab>(initialTab);
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
              onPasskeyLogin={async () => {
                const ok = await loginWithPasskey();
                if (ok) onClose();
              }}
              onPasskeySignup={async (input) => {
                const ok = await signupWithPasskey(input);
                if (ok) onClose();
                return ok;
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
              onPasskeySignup={async (input) => {
                const ok = await signupWithPasskey(input);
                if (ok) onClose();
                return ok;
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
  onSubmit, error, onAdmin, onPasskeyLogin, onPasskeySignup,
}: {
  onSubmit: (input: { username: string; password: string }) => Promise<void>;
  error: string | null;
  onAdmin: () => void;
  onPasskeyLogin: () => Promise<void>;
  onPasskeySignup: (input: { username: string; securityQuestion: string; securityAnswer: string }) => Promise<boolean>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  // Signup sub-flow — username + security question/answer (so the user can
  // recover the account if they lose their device).
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupUsername, setSignupUsername] = useState('');
  const [signupQuestion, setSignupQuestion] = useState(QUESTION_SUGGESTIONS[0]);
  const [signupCustomQuestion, setSignupCustomQuestion] = useState('');
  const [signupAnswer, setSignupAnswer] = useState('');
  const [signupErr, setSignupErr] = useState<string | null>(null);
  const [signupBusy, setSignupBusy] = useState(false);

  const signupUsingCustom = signupQuestion === '__custom__';
  const signupFinalQuestion = signupUsingCustom ? signupCustomQuestion.trim() : signupQuestion;

  useEffect(() => {
    void isPlatformAuthenticatorAvailable().then(setPasskeySupported);
  }, []);

  async function handlePasskey() {
    setLocalErr(null);
    setPasskeyBusy(true);
    try { await onPasskeyLogin(); }
    finally { setPasskeyBusy(false); }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupErr(null);
    const name = signupUsername.trim();
    if (name.length < 2) { setSignupErr('Skriv ett användarnamn (minst 2 tecken).'); return; }
    if (signupFinalQuestion.length < 4) { setSignupErr('Välj eller skriv en säkerhetsfråga.'); return; }
    if (!signupAnswer.trim()) { setSignupErr('Skriv ett svar på säkerhetsfrågan.'); return; }
    setSignupBusy(true);
    try {
      const ok = await onPasskeySignup({
        username: name,
        securityQuestion: signupFinalQuestion,
        securityAnswer: signupAnswer,
      });
      if (!ok) setSignupErr('Misslyckades. Försök igen eller välj ett annat namn.');
    } finally {
      setSignupBusy(false);
    }
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    if (!username.trim()) { setLocalErr('Fyll i användarnamn.'); return; }
    if (!password) { setLocalErr('Fyll i lösenord.'); return; }
    setBusy(true);
    await onSubmit({ username, password });
    setBusy(false);
  }

  return (
    <form onSubmit={handle} className="login-form">
      {passkeySupported && (
        <>
          <button
            type="button"
            className="btn btn-passkey"
            onClick={handlePasskey}
            disabled={passkeyBusy}
          >
            <PasskeyIcon /> {passkeyBusy ? 'Väntar på enhet…' : 'Logga in med Face ID / Touch ID'}
          </button>
          {!signupOpen ? (
            <button
              type="button"
              className="login-link"
              onClick={() => setSignupOpen(true)}
              style={{ textAlign: 'center', justifySelf: 'center' }}
            >
              Inget konto än? Skapa med Face ID →
            </button>
          ) : (
            <div className="passkey-signup-box">
              <div className="section-eyebrow" style={{ marginBottom: 6 }}>Skapa konto</div>
              <label className="admin-field" style={{ marginBottom: 8 }}>
                <span>Välj användarnamn</span>
                <input
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  placeholder="t.ex. jacob"
                  autoComplete="username webauthn"
                  autoFocus
                />
              </label>
              <label className="admin-field" style={{ marginBottom: 8 }}>
                <span>Säkerhetsfråga (för återställning om du tappar telefonen)</span>
                <select value={signupQuestion} onChange={(e) => setSignupQuestion(e.target.value)}>
                  {QUESTION_SUGGESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                  <option value="__custom__">Egen fråga…</option>
                </select>
              </label>
              {signupUsingCustom && (
                <label className="admin-field" style={{ marginBottom: 8 }}>
                  <span>Din egen fråga</span>
                  <input
                    value={signupCustomQuestion}
                    onChange={(e) => setSignupCustomQuestion(e.target.value)}
                    placeholder="t.ex. Vad var min första hund?"
                  />
                </label>
              )}
              <label className="admin-field" style={{ marginBottom: 8 }}>
                <span>Svar</span>
                <input
                  value={signupAnswer}
                  onChange={(e) => setSignupAnswer(e.target.value)}
                  placeholder="Stora/små bokstäver spelar ingen roll"
                />
              </label>
              {signupErr && <div className="login-error" style={{ marginBottom: 8 }}>{signupErr}</div>}
              <div className="modal-photo-controls">
                <button type="button" className="btn btn-purple" onClick={(e) => handleSignup(e as unknown as React.FormEvent)} disabled={signupBusy}>
                  {signupBusy ? 'Väntar på enhet…' : 'Fortsätt med Face ID'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setSignupOpen(false); setSignupErr(null); }}>Avbryt</button>
              </div>
            </div>
          )}
          <div className="login-divider"><span>eller med lösenord</span></div>
        </>
      )}
      <label className="admin-field">
        <span>Användarnamn</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus={!passkeySupported} autoComplete="username webauthn" />
      </label>
      <label className="admin-field">
        <span>Lösenord</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password webauthn" />
      </label>
      {(localErr || error) && <div className="login-error">{localErr || error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy}>
          {busy ? 'Loggar in…' : 'Logga in'}
        </button>
      </div>
      <button type="button" className="login-link" onClick={onAdmin}>
        Logga in som admin →
      </button>
    </form>
  );
}

function PasskeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 11a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm-3 6a6 6 0 0 1 12 0v1H6v-1Zm12-9V6a6 6 0 0 0-12 0v2H4v12h16V8h-2ZM8 8V6a4 4 0 0 1 8 0v2H8Z" />
    </svg>
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
  const [localErr, setLocalErr] = useState<string | null>(null);
  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    if (!pw) { setLocalErr('Fyll i admin-lösenord.'); return; }
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
      {(localErr || error) && <div className="login-error">{localErr || error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy}>
          {busy ? 'Loggar in…' : 'Logga in'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>Tillbaka</button>
      </div>
    </form>
  );
}

function RegisterForm({
  onSubmit, onPasskeySignup, error,
}: {
  onSubmit: (input: { username: string; password: string; securityQuestion: string; securityAnswer: string }) => Promise<void>;
  onPasskeySignup: (input: { username: string; securityQuestion: string; securityAnswer: string }) => Promise<boolean>;
  error: string | null;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [questionChoice, setQuestionChoice] = useState(QUESTION_SUGGESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const usingCustom = questionChoice === '__custom__';
  const question = usingCustom ? customQuestion.trim() : questionChoice;
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    void isPlatformAuthenticatorAvailable().then(setPasskeySupported);
  }, []);

  // Shared validation for the bits a passkey signup needs (everything
  // except the password). Returns an error string or null.
  function validateShared(): string | null {
    if (username.trim().length < 2) return 'Användarnamn: minst 2 tecken.';
    if (question.length < 4) return 'Skriv en säkerhetsfråga.';
    if (!answer.trim()) return 'Skriv ett svar på säkerhetsfrågan.';
    return null;
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    const shared = validateShared();
    if (shared) { setLocalErr(shared); return; }
    if (password.length < 6) { setLocalErr('Lösenord: minst 6 tecken.'); return; }
    setBusy(true);
    await onSubmit({ username, password, securityQuestion: question, securityAnswer: answer });
    setBusy(false);
  }

  async function handlePasskey() {
    setLocalErr(null);
    const shared = validateShared();
    if (shared) { setLocalErr(shared); return; }
    setPasskeyBusy(true);
    try {
      const ok = await onPasskeySignup({
        username: username.trim(),
        securityQuestion: question,
        securityAnswer: answer,
      });
      if (!ok) setLocalErr('Misslyckades. Försök igen eller välj ett annat namn.');
    } finally {
      setPasskeyBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="login-form">
      <label className="admin-field">
        <span>Användarnamn</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username webauthn" />
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
        Svaret används om du glömmer ditt lösenord eller tappar din enhet.
        Stora/små bokstäver och mellanslag spelar ingen roll.
      </div>

      {passkeySupported && (
        <>
          <button
            type="button"
            className="btn btn-passkey"
            onClick={handlePasskey}
            disabled={passkeyBusy || busy}
          >
            <PasskeyIcon /> {passkeyBusy ? 'Väntar på enhet…' : 'Skapa konto med Face ID / Touch ID'}
          </button>
          <div className="login-divider"><span>eller med lösenord</span></div>
        </>
      )}

      <label className="admin-field">
        <span>Lösenord (minst 6 tecken)</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </label>
      {(localErr || error) && <div className="login-error">{localErr || error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy || passkeyBusy}>
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
  const [localErr, setLocalErr] = useState<string | null>(null);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    if (!username.trim()) { setLocalErr('Fyll i användarnamn.'); return; }
    setBusy(true);
    const q = await onStart(username);
    setBusy(false);
    if (q) setQuestion(q);
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    if (!answer.trim()) { setLocalErr('Skriv ditt svar.'); return; }
    if (newPassword.length < 6) { setLocalErr('Nytt lösenord: minst 6 tecken.'); return; }
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
        {(localErr || error) && <div className="login-error">{localErr || error}</div>}
        <div className="modal-photo-controls">
          <button type="submit" className="btn btn-purple" disabled={busy}>
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
      {(localErr || error) && <div className="login-error">{localErr || error}</div>}
      <div className="modal-photo-controls">
        <button type="submit" className="btn btn-purple" disabled={busy}>
          {busy ? 'Sätter…' : 'Sätt nytt lösenord'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setQuestion(null)}>Tillbaka</button>
      </div>
    </form>
  );
}
