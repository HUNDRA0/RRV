import { useState } from 'react';
import type { ClientGameState, ClientPlayer, Resource, Resources } from './types';

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  grain: '🌾',
  ore: '⛏️',
  wool: '🐑',
};

const RESOURCES: Resource[] = ['wood', 'brick', 'grain', 'ore', 'wool'];

function emptyResources(): Resources {
  return { wood: 0, brick: 0, grain: 0, ore: 0, wool: 0 };
}

interface TradeModalProps {
  state: ClientGameState;
  myPlayer: ClientPlayer;
  onAction: (action: object) => void;
  onClose: () => void;
}

function getBankRatio(state: ClientGameState, myPlayer: ClientPlayer, resource: Resource): number {
  // Check for 2:1 harbor
  const myVertexIds = new Set<string>();
  state.board.vertices.forEach(v => {
    if (v.building?.playerId === myPlayer.id) myVertexIds.add(v.id);
  });
  const has2to1 = state.board.vertices.some(v => myVertexIds.has(v.id) && v.harbor === resource);
  if (has2to1) return 2;
  const has3to1 = state.board.vertices.some(v => myVertexIds.has(v.id) && v.harbor === 'any');
  if (has3to1) return 3;
  return 4;
}

export function TradeModal({ state, myPlayer, onAction, onClose }: TradeModalProps) {
  const [tab, setTab] = useState<'bank' | 'player'>('bank');
  const [give, setGive] = useState<Resources>(emptyResources());
  const [want, setWant] = useState<Resources>(emptyResources());
  const [selectedGive, setSelectedGive] = useState<Resource | null>(null);
  const [selectedWant, setSelectedWant] = useState<Resource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const res = myPlayer.resources;

  const handleBankTrade = () => {
    if (!selectedGive || !selectedWant) { setError('Välj resurs att ge och ta'); return; }
    const ratio = getBankRatio(state, myPlayer, selectedGive);
    if (res[selectedGive] < ratio) { setError(`Du behöver ${ratio}x ${RESOURCE_EMOJI[selectedGive]}`); return; }
    onAction({ type: 'tradeBank', give: selectedGive, want: selectedWant });
    onClose();
  };

  const handleOfferPlayer = () => {
    const totalGive = RESOURCES.reduce((s, r) => s + give[r], 0);
    const totalWant = RESOURCES.reduce((s, r) => s + want[r], 0);
    if (totalGive === 0 || totalWant === 0) { setError('Specificera vad du ger och vad du vill ha'); return; }
    for (const r of RESOURCES) {
      if (give[r] > res[r]) { setError(`Inte tillräckligt med ${RESOURCE_EMOJI[r]}`); return; }
    }
    onAction({ type: 'tradeOffer', give, want });
    onClose();
  };

  const adjustRes = (which: 'give' | 'want', r: Resource, delta: number) => {
    if (which === 'give') {
      setGive(prev => {
        const next = { ...prev, [r]: Math.max(0, Math.min(prev[r] + delta, res[r])) };
        return next;
      });
    } else {
      setWant(prev => ({ ...prev, [r]: Math.max(0, prev[r] + delta) }));
    }
  };

  return (
    <div className="catan-modal-overlay" onClick={onClose}>
      <div className="catan-modal" onClick={e => e.stopPropagation()}>
        <div className="catan-modal-header">
          <h2 className="catan-modal-title">Handel 🔄</h2>
          <button className="catan-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="catan-tabs">
          <button className={`catan-tab${tab === 'bank' ? ' active' : ''}`} onClick={() => setTab('bank')}>Bank</button>
          <button className={`catan-tab${tab === 'player' ? ' active' : ''}`} onClick={() => setTab('player')}>Spelare</button>
        </div>

        {tab === 'bank' && (
          <div className="catan-trade-bank">
            <p className="catan-muted" style={{ fontSize: 13, marginBottom: 12 }}>
              Välj vad du ger (banken tar mer utan hamn):
            </p>
            <div className="catan-trade-grid">
              {RESOURCES.map(r => {
                const ratio = getBankRatio(state, myPlayer, r);
                const canTrade = res[r] >= ratio;
                return (
                  <button
                    key={r}
                    className={`catan-trade-chip${selectedGive === r ? ' selected' : ''}${!canTrade ? ' disabled' : ''}`}
                    disabled={!canTrade}
                    onClick={() => setSelectedGive(selectedGive === r ? null : r)}
                  >
                    <span>{RESOURCE_EMOJI[r]}</span>
                    <span>{ratio}:1</span>
                    <span className="catan-muted" style={{ fontSize: 11 }}>({res[r]})</span>
                  </button>
                );
              })}
            </div>
            <p className="catan-muted" style={{ fontSize: 13, margin: '16px 0 8px' }}>
              Vad vill du ha?
            </p>
            <div className="catan-trade-grid">
              {RESOURCES.map(r => (
                <button
                  key={r}
                  className={`catan-trade-chip${selectedWant === r ? ' selected' : ''}`}
                  disabled={selectedGive === r}
                  onClick={() => setSelectedWant(selectedWant === r ? null : r)}
                >
                  <span>{RESOURCE_EMOJI[r]}</span>
                </button>
              ))}
            </div>
            {error && <p className="catan-error">{error}</p>}
            <button className="catan-btn catan-btn-primary" onClick={handleBankTrade} style={{ marginTop: 16, width: '100%' }}>
              Byt med bank
            </button>
          </div>
        )}

        {tab === 'player' && (
          <div className="catan-trade-player">
            <div className="catan-trade-section">
              <p className="catan-muted" style={{ fontSize: 13 }}>Du ger:</p>
              {RESOURCES.map(r => (
                <div key={r} className="catan-trade-row-adj">
                  <span>{RESOURCE_EMOJI[r]}</span>
                  <button className="catan-adj-btn" onClick={() => adjustRes('give', r, -1)}>−</button>
                  <span className="catan-adj-val">{give[r]}</span>
                  <button className="catan-adj-btn" onClick={() => adjustRes('give', r, 1)}>+</button>
                  <span className="catan-muted" style={{ fontSize: 11 }}>/{res[r]}</span>
                </div>
              ))}
            </div>
            <div className="catan-trade-section" style={{ marginTop: 12 }}>
              <p className="catan-muted" style={{ fontSize: 13 }}>Du vill ha:</p>
              {RESOURCES.map(r => (
                <div key={r} className="catan-trade-row-adj">
                  <span>{RESOURCE_EMOJI[r]}</span>
                  <button className="catan-adj-btn" onClick={() => adjustRes('want', r, -1)}>−</button>
                  <span className="catan-adj-val">{want[r]}</span>
                  <button className="catan-adj-btn" onClick={() => adjustRes('want', r, 1)}>+</button>
                </div>
              ))}
            </div>
            {error && <p className="catan-error">{error}</p>}
            <button className="catan-btn catan-btn-primary" onClick={handleOfferPlayer} style={{ marginTop: 16, width: '100%' }}>
              Erbjud spelare
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
