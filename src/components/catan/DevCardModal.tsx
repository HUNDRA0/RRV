import { useState } from 'react';
import type { DevCardType, Resource } from './types';

const RESOURCE_EMOJI: Record<Resource, string> = {
  wood: '🪵',
  brick: '🧱',
  grain: '🌾',
  ore: '⛏️',
  wool: '🐑',
};

const RESOURCES: Resource[] = ['wood', 'brick', 'grain', 'ore', 'wool'];

const DEV_CARD_INFO: Record<DevCardType, { label: string; desc: string; emoji: string }> = {
  knight: { label: 'Riddare', desc: 'Flytta rövaren och stjäl en resurs', emoji: '⚔️' },
  roadBuilding: { label: 'Vägbygge', desc: 'Bygg 2 vägar gratis', emoji: '🛤️' },
  yearOfPlenty: { label: 'Överflödets år', desc: 'Ta 2 valfria resurser från banken', emoji: '🎁' },
  monopoly: { label: 'Monopol', desc: 'Ta alla av en resurs från alla spelare', emoji: '💰' },
  victoryPoint: { label: 'Segerpoäng', desc: '+1 segerpoäng', emoji: '⭐' },
};

interface DevCardModalProps {
  devCards: DevCardType[];
  devCardPlayedThisTurn: boolean;
  diceRolled: boolean;
  onAction: (action: object) => void;
  onClose: () => void;
}

export function DevCardModal({ devCards, devCardPlayedThisTurn, diceRolled, onAction, onClose }: DevCardModalProps) {
  const [pickMode, setPickMode] = useState<'yearOfPlenty' | 'monopoly' | null>(null);
  const [pickedResources, setPickedResources] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Deduplicate and count cards
  const cardCounts = devCards.reduce<Record<DevCardType, number>>(
    (acc, c) => { acc[c] = (acc[c] ?? 0) + 1; return acc; },
    {} as Record<DevCardType, number>,
  );
  const uniqueCards = Object.keys(cardCounts) as DevCardType[];

  const canPlay = !devCardPlayedThisTurn;

  const handlePlay = (cardType: DevCardType) => {
    if (!canPlay) { setError('Du kan bara spela ett utvecklingskort per tur'); return; }
    if (cardType === 'victoryPoint') {
      onAction({ type: 'playDevCard', card: cardType });
      onClose();
      return;
    }
    if (cardType === 'yearOfPlenty') {
      setPickMode('yearOfPlenty');
      setPickedResources([]);
      return;
    }
    if (cardType === 'monopoly') {
      setPickMode('monopoly');
      setPickedResources([]);
      return;
    }
    // knight, roadBuilding → dispatch and close
    onAction({ type: 'playDevCard', card: cardType });
    onClose();
  };

  const handlePickResource = (r: Resource) => {
    if (pickMode === 'yearOfPlenty') {
      if (pickedResources.length < 2) {
        const next = [...pickedResources, r];
        setPickedResources(next);
        if (next.length === 2) {
          onAction({ type: 'playDevCard', card: 'yearOfPlenty', params: { resource1: next[0], resource2: next[1] } });
          onClose();
        }
      }
    } else if (pickMode === 'monopoly') {
      onAction({ type: 'playDevCard', card: 'monopoly', params: { resource: r } });
      onClose();
    }
  };

  if (pickMode) {
    return (
      <div className="catan-modal-overlay" onClick={onClose}>
        <div className="catan-modal" onClick={e => e.stopPropagation()}>
          <div className="catan-modal-header">
            <h2 className="catan-modal-title">
              {pickMode === 'yearOfPlenty'
                ? `Välj resurser (${pickedResources.length}/2)`
                : 'Välj resurs (Monopol)'}
            </h2>
            <button className="catan-modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="catan-trade-grid" style={{ marginTop: 16 }}>
            {RESOURCES.map(r => (
              <button
                key={r}
                className="catan-trade-chip"
                onClick={() => handlePickResource(r)}
              >
                <span style={{ fontSize: 28 }}>{RESOURCE_EMOJI[r]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catan-modal-overlay" onClick={onClose}>
      <div className="catan-modal" onClick={e => e.stopPropagation()}>
        <div className="catan-modal-header">
          <h2 className="catan-modal-title">Utvecklingskort 🂠</h2>
          <button className="catan-modal-close" onClick={onClose}>✕</button>
        </div>

        {devCardPlayedThisTurn && (
          <p className="catan-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Du har redan spelat ett utvecklingskort denna tur.
          </p>
        )}

        {diceRolled === false && (
          <p className="catan-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Riddare kan spelas innan tärningskast. Övriga kort kan inte.
          </p>
        )}

        {error && <p className="catan-error">{error}</p>}

        <div className="catan-devcards">
          {uniqueCards.map(cardType => {
            const info = DEV_CARD_INFO[cardType];
            const count = cardCounts[cardType] ?? 0;
            const isKnight = cardType === 'knight';
            const disabled = !canPlay || (diceRolled === false && !isKnight);
            return (
              <div key={cardType} className={`catan-devcard${disabled ? ' disabled' : ''}`}>
                <span className="catan-devcard-emoji">{info.emoji}</span>
                <div className="catan-devcard-info">
                  <span className="catan-devcard-name">{info.label} ×{count}</span>
                  <span className="catan-devcard-desc">{info.desc}</span>
                </div>
                <button
                  className="catan-btn catan-btn-primary catan-btn-sm"
                  disabled={disabled}
                  onClick={() => handlePlay(cardType)}
                >
                  Spela
                </button>
              </div>
            );
          })}
          {uniqueCards.length === 0 && (
            <p className="catan-muted">Inga utvecklingskort på hand.</p>
          )}
        </div>
      </div>
    </div>
  );
}
