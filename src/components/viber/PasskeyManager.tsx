// "Mina passkeys" — list, rename (TODO), delete, add new one.
// Surfaced from the user dropdown when the user is logged in.
//
// On unsupported browsers we hide the "Add new" button but still show
// the list so a user with an existing passkey can manage it.

import { useEffect, useState } from 'react';
import { useEsc, useLockBody } from '../../hooks/useViberHooks';
import { userTokenStore } from '../../lib/api';
import {
  registerPasskey,
  listPasskeys,
  deletePasskey,
  isPlatformAuthenticatorAvailable,
  type PasskeyEntry,
} from '../../lib/passkey';

interface PasskeyManagerProps {
  onClose: () => void;
}

export function PasskeyManager({ onClose }: PasskeyManagerProps) {
  const [items, setItems] = useState<PasskeyEntry[] | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useLockBody(true);
  useEsc(onClose, true);

  async function refresh() {
    const token = userTokenStore.get();
    if (!token) { setErr('Inte inloggad.'); return; }
    try { setItems(await listPasskeys(token)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'fel'); }
  }

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setSupported);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAdd() {
    setErr(null); setMsg(null);
    const token = userTokenStore.get();
    if (!token) { setErr('Inte inloggad.'); return; }
    setBusy(true);
    try {
      const cred = await registerPasskey(token);
      setMsg(`✓ ${cred.deviceLabel} registrerad`);
      await refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'okänt fel';
      // Browser cancellations come through as a DOMException — friendly message.
      if (/cancel|aborted/i.test(m)) setErr('Avbruten.');
      else setErr(m);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Ta bort denna passkey?')) return;
    const token = userTokenStore.get();
    if (!token) return;
    try {
      await deletePasskey(token, id);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'fel');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Passkeys">
        <button className="modal-close" onClick={onClose} aria-label="Stäng">✕</button>
        <div className="modal-info" style={{ padding: '32px 32px 28px', maxWidth: 480 }}>
          <div className="section-eyebrow">Säkerhet</div>
          <h2 className="modal-name" style={{ fontSize: 26, marginBottom: 10 }}>
            <em style={{ fontStyle: 'italic' }}>Face ID</em> & passkeys
          </h2>
          <p className="card-meta" style={{ marginBottom: 18 }}>
            Logga in med fingeravtryck eller ansiktsigenkänning. En passkey är bunden till just den här enheten — registrera en på varje enhet du använder.
          </p>

          {supported === false && (
            <div className="login-error" style={{ marginBottom: 14 }}>
              Den här webbläsaren stöder inte Face ID / Touch ID. På iPhone: använd Safari (iOS 16+). På Mac/PC: använd Safari, Chrome eller Edge.
            </div>
          )}

          <div className="passkey-list">
            {items === null && <p className="card-meta">Laddar…</p>}
            {items && items.length === 0 && <p className="card-meta">Inga passkeys ännu.</p>}
            {items?.map(p => (
              <div className="passkey-row" key={p.id}>
                <div>
                  <div className="passkey-label">{p.deviceLabel}</div>
                  <div className="passkey-meta">
                    Tillagd {p.createdAt.split(' ')[0]}
                    {p.lastUsedAt && ` · senast använd ${p.lastUsedAt.split(' ')[0]}`}
                  </div>
                </div>
                <button className="passkey-delete" onClick={() => onDelete(p.id)} aria-label="Ta bort">✕</button>
              </div>
            ))}
          </div>

          {msg && <div className="login-hint" style={{ color: 'var(--purple-2)' }}>{msg}</div>}
          {err && <div className="login-error">{err}</div>}

          <div className="modal-photo-controls" style={{ marginTop: 14 }}>
            <button
              className="btn btn-purple"
              onClick={onAdd}
              disabled={busy || supported === false}
            >
              {busy ? 'Väntar på enhet…' : '+ Lägg till passkey'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Stäng</button>
          </div>
        </div>
      </div>
    </div>
  );
}
