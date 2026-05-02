import { useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';

interface AdminLoginModalProps {
  onClose: () => void;
  onLogin: (password: string) => Promise<boolean>;
  loginError: string | null;
}

export function AdminLoginModal({ onClose, onLogin, loginError }: AdminLoginModalProps) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  useLockBody(true);
  useEsc(onClose, true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await onLogin(pw);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ gridTemplateColumns: '1fr', maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Admin login"
      >
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        <form className="modal-info" onSubmit={submit} style={{ padding: '36px 32px' }}>
          <div className="section-eyebrow">Admin Console</div>
          <h2 className="modal-name" style={{ fontSize: 36 }}>
            <em style={{ fontStyle: 'italic', background: 'linear-gradient(150deg, var(--purple), var(--purple-3))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Viber</em> Admin
          </h2>
          <label className="admin-field">
            <span>Lösenord</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </label>
          {loginError && (
            <div style={{ color: 'var(--rose)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              {loginError}
            </div>
          )}
          <div className="modal-photo-controls">
            <button type="submit" className="btn btn-purple" disabled={busy || !pw}>
              {busy ? 'Loggar in…' : 'Logga in'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Avbryt</button>
          </div>
        </form>
      </div>
    </div>
  );
}
