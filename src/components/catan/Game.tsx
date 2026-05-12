import { useState, useRef, useEffect } from 'react';
import type { ClientGameState, ClientPlayer, Resources } from './types';
import { Board } from './Board';
import type { DiceAnimPhase } from './Board';
import { TradeModal } from './TradeModal';
import { DevCardModal } from './DevCardModal';
import {
  canAfford,
  getValidSettlementPlacements,
  getValidRoadPlacements,
  getValidCityPlacements,
  getValidRobberHexes,
} from './gameHelpers';

const RESOURCE_EMOJI: Record<string, string> = {
  wood: '🌲', brick: '🧱', grain: '🌾', ore: '🪨', wool: '🐑',
};

// ── Swedish error translations ──────────────────────────────────────────────
const ERROR_TRANSLATIONS: Record<string, string> = {
  'Not your turn':                            'Det är inte din tur',
  'Not in playing phase':                     'Spelet är inte i spelläge',
  'Not in dice-off phase':                    'Inte i startfasen',
  'Roll dice first':                          'Kasta tärningen först',
  'Dice already rolled this turn':            'Du har redan kastat tärningen den här rundan',
  'Resolve pending action first':             'Slutför din pågående åtgärd först',
  'Not enough resources':                     'Du har inte tillräckligt med resurser',
  'No settlements left':                      'Inga bosättningar kvar',
  'No cities left':                           'Inga städer kvar',
  'No roads left':                            'Inga vägar kvar',
  'No roads left to place':                   'Inga vägar kvar att placera',
  'Too close to another settlement':          'För nära en annan bosättning',
  'Vertex already occupied':                  'Den platsen är redan upptagen',
  'Settlement must be connected to your road':'Bosättningen måste anslutas till ditt vägnät',
  'Road must connect to your last settlement':'Vägen måste anslutas till din senast placerade bosättning',
  'Road must connect to your network':        'Vägen måste anslutas till ditt vägnät',
  'Edge already has a road':                  'Det finns redan en väg där',
  'No own settlement at that vertex':         'Du har ingen bosättning på den platsen',
  'No pending robber move':                   'Ingen rövare att flytta',
  'No pending steal':                         'Inget att stjäla',
  'Must move robber to a different hex':      'Rövaren måste flyttas till ett annat fält',
  'Invalid hex':                              'Ogiltigt fält',
  'Cannot steal from that player':            'Du kan inte stjäla från den spelaren',
  'Target player not found':                  'Spelaren hittades inte',
  'Not enough resources to offer':            'Du har inte tillräckligt med resurser att erbjuda',
  'A trade offer is already active':          'Ett handelserbjudande är redan aktivt',
  'Cancel trade offer first':                 'Avbryt det pågående handelserbjudandet först',
  'No active trade offer':                    'Inget aktivt handelserbjudande',
  'Cannot respond to your own offer':         'Du kan inte svara på ditt eget erbjudande',
  'Not a valid responder':                    'Du kan inte svara på detta erbjudande',
  'You do not have the requested resources':  'Du har inte de begärda resurserna',
  'Acceptor no longer has enough resources':  'Motparten har inte längre tillräckliga resurser',
  'Offeror no longer has enough resources':   'Du har inte längre tillräckliga resurser',
  'That player has not accepted':             'Den spelaren har inte accepterat',
  'Only the offeror can complete the trade':  'Bara du kan slutföra handeln',
  'Only the offeror can cancel the trade':    'Bara du kan avbryta handeln',
  'Cannot trade a resource for itself':       'Du kan inte handla en resurs mot sig själv',
  'Bank has no more of that resource':        'Banken har inga fler av den resursen',
  'Development card deck is empty':           'Kortleken är tom',
  'You do not have that card':                'Du har inte det kortet',
  'Can only play one development card per turn': 'Du kan bara spela ett utvecklingskort per tur',
  'Cannot play a card bought this turn':      'Du kan inte spela ett kort du köpte denna tur',
  'Place a settlement first':                 'Placera en bosättning först',
  'Place a road first':                       'Placera en väg först',
  'You already rolled this round':            'Du har redan kastat denna omgång',
  'You are not in the current roll-off':      'Du deltar inte i den nuvarande omrullningen',
  'Game is over':                             'Spelet är slut',
  'Game already started':                     'Spelet har redan börjat',
  'Game is full':                             'Spelet är fullt',
  'Only the host can start the game':         'Bara värden kan starta spelet',
  'Need at least 2 players to start':         'Minst 2 spelare krävs för att starta',
  'Already in game':                          'Du är redan med i spelet',
  'No settlement found for road placement':   'Ingen bosättning hittades för vägplacering',
  'Specify two resources':                    'Välj två resurser',
  'Specify a resource':                       'Välj en resurs',
  'No current player':                        'Ingen aktiv spelare',
  'Player not found':                         'Spelaren hittades inte',
  'Unknown action type':                      'Okänd åtgärd',
  'No active timer':                          'Ingen aktiv timer',
  'Turn not yet expired':                     'Turen är inte slut än',
};

function translateError(msg: string): string {
  // Exact match
  if (ERROR_TRANSLATIONS[msg]) return ERROR_TRANSLATIONS[msg];
  // Partial match (for dynamic messages like "Need 4 wood to trade")
  for (const [key, val] of Object.entries(ERROR_TRANSLATIONS)) {
    if (msg.startsWith(key) || msg.includes(key)) return val;
  }
  return msg; // fallback: show as-is if no translation found
}
const RESOURCES_LIST = ['wood', 'brick', 'grain', 'ore', 'wool'] as const;

function formatResources(r: Resources): string {
  return RESOURCES_LIST
    .filter(k => r[k] > 0)
    .map(k => `${r[k]}×${RESOURCE_EMOJI[k]}`)
    .join(' ') || '—';
}

// ── Catan-style SVG icons ────────────────────────────────────────────────────
function IconSettlement({ size = 36 }: { size?: number }) {
  // Classic Catan settlement: square base + triangular peaked roof
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* roof */}
      <polygon points="18,4 32,20 4,20" fill="#c8783a" stroke="#7a3d10" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* walls */}
      <rect x="7" y="19" width="22" height="13" rx="1" fill="#e8a060" stroke="#7a3d10" strokeWidth="1.5"/>
      {/* door */}
      <rect x="14" y="25" width="8" height="7" rx="1" fill="#7a3d10"/>
      {/* roof ridge */}
      <line x1="18" y1="4" x2="18" y2="19" stroke="#7a3d10" strokeWidth="1" strokeDasharray="2,2" opacity="0.4"/>
    </svg>
  );
}

function IconCity({ size = 36 }: { size?: number }) {
  // Catan city: a tall tower (left) + wider hall (right)
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* wide hall */}
      <rect x="16" y="20" width="17" height="12" rx="1" fill="#a08cd0" stroke="#5b3fa0" strokeWidth="1.5"/>
      {/* hall roof */}
      <polygon points="16,20 33,20 33,15 16,15" fill="#8870c0" stroke="#5b3fa0" strokeWidth="1.5"/>
      {/* tall tower */}
      <rect x="4" y="11" width="15" height="21" rx="1" fill="#c0a8e8" stroke="#5b3fa0" strokeWidth="1.5"/>
      {/* tower roof */}
      <polygon points="4,11 19,11 11.5,4" fill="#a080d0" stroke="#5b3fa0" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* tower door */}
      <rect x="8" y="25" width="7" height="7" rx="1" fill="#5b3fa0"/>
      {/* tower window */}
      <rect x="9" y="16" width="5" height="5" rx="0.5" fill="#fbbf24" opacity="0.8"/>
    </svg>
  );
}

function IconRoad({ size = 36 }: { size?: number }) {
  // Catan road: a plank/log bridge at an angle
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* main road plank (rotated rectangle) */}
      <rect x="4" y="13" width="28" height="10" rx="3" fill="#c8783a" stroke="#7a3d10" strokeWidth="1.5"
        transform="rotate(-18 18 18)"/>
      {/* wood grain lines */}
      <line x1="10" y1="10" x2="8" y2="26" stroke="#7a3d10" strokeWidth="1" opacity="0.35"
        transform="rotate(-18 18 18)"/>
      <line x1="18" y1="8" x2="16" y2="28" stroke="#7a3d10" strokeWidth="1" opacity="0.35"
        transform="rotate(-18 18 18)"/>
      <line x1="26" y1="10" x2="24" y2="26" stroke="#7a3d10" strokeWidth="1" opacity="0.35"
        transform="rotate(-18 18 18)"/>
    </svg>
  );
}

function IconDevCard({ size = 36 }: { size?: number }) {
  // Ornate development card: purple card with gold shield / star
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* card body */}
      <rect x="5" y="2" width="26" height="32" rx="3" fill="#4c1d95" stroke="#fbbf24" strokeWidth="1.8"/>
      {/* inner border */}
      <rect x="8" y="5" width="20" height="26" rx="2" fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity="0.5"/>
      {/* gold star / knight symbol */}
      <text x="18" y="23" textAnchor="middle" fontSize="18" fill="#fbbf24">★</text>
      {/* card top pip */}
      <circle cx="18" cy="8" r="2" fill="#fbbf24" opacity="0.8"/>
    </svg>
  );
}

function IconTrade({ size = 36 }: { size?: number }) {
  // Two arrows crossing = trade
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* top-left to bottom-right arrow */}
      <path d="M6 10 L26 10 L26 16" stroke="#e8a060" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polygon points="22,7 30,10 22,13" fill="#e8a060"/>
      {/* bottom-right to top-left arrow */}
      <path d="M30 26 L10 26 L10 20" stroke="#a080d0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polygon points="14,29 6,26 14,23" fill="#a080d0"/>
    </svg>
  );
}

function IconPlayCard({ size = 36 }: { size?: number }) {
  // Sword — use dev card
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* blade */}
      <path d="M20 6 L30 4 L28 14 L10 30 L6 26 Z" fill="#d0d8e8" stroke="#5b7090" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* guard */}
      <rect x="12" y="20" width="12" height="3.5" rx="1.5" fill="#fbbf24" stroke="#a07800" strokeWidth="1"
        transform="rotate(-45 18 21.75)"/>
      {/* grip */}
      <rect x="5" y="27" width="10" height="3" rx="1.5" fill="#7a3d10" stroke="#4a1d00" strokeWidth="1"
        transform="rotate(-45 10 28.5)"/>
      {/* blade shine */}
      <line x1="12" y1="24" x2="25" y2="9" stroke="white" strokeWidth="1" opacity="0.5"
        strokeLinecap="round"/>
    </svg>
  );
}

// Building costs used by the action bar
const BUILDING_COSTS: Record<string, Resources> = {
  settlement: { wood: 1, brick: 1, grain: 1, wool: 1, ore: 0 },
  road:       { wood: 1, brick: 1, grain: 0, wool: 0, ore: 0 },
  city:       { wood: 0, brick: 0, grain: 2, wool: 0, ore: 3 },
  devCard:    { wood: 0, brick: 0, grain: 1, wool: 1, ore: 1 },
};

// ---- Action bar component ----
interface ActionBarProps {
  state: ClientGameState;
  myPlayer: ClientPlayer;
  buildMode: string | null;
  setBuildMode: (mode: string | null) => void;
  onAction: (action: object) => void;
  onOpenTrade: () => void;
  onOpenDevCard: () => void;
}

const RESOURCE_EMOJI_BAR: Record<string, string> = {
  wood: '🌲', brick: '🧱', grain: '🌾', ore: '🪨', wool: '🐑',
};

const BUILDING_INFO: Record<string, { name: string; emoji: string; cost: Resources }> = {
  settlement: { name: 'Bosättning', emoji: '🏠', cost: BUILDING_COSTS.settlement },
  road:       { name: 'Väg',        emoji: '🛤️', cost: BUILDING_COSTS.road },
  city:       { name: 'Stad',       emoji: '🏙️', cost: BUILDING_COSTS.city },
  devCard:    { name: 'Utvecklingskort', emoji: '🂠', cost: BUILDING_COSTS.devCard },
};

// ── Turn timer (hourglass + countdown) ─────────────────────────────────────
function TurnTimer({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline === null) return null;
  const remainingMs = Math.max(0, deadline - now);
  const secs = Math.ceil(remainingMs / 1000);
  const isWarning = secs <= 10;
  return (
    <span className={`catan-turn-timer${isWarning ? ' warning' : ''}`} title="Tid kvar på turen">
      <span className="catan-turn-timer-icon">⏳</span>
      <span className="catan-turn-timer-secs">{secs}s</span>
    </span>
  );
}

function ActionBar({ state, myPlayer, buildMode, setBuildMode, onAction, onOpenTrade, onOpenDevCard }: ActionBarProps) {
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myPlayer.id;
  const isPlaying = state.phase === 'playing';
  const isSetup = state.phase === 'setup';
  const res = myPlayer.resources;
  const myDevCards = Array.isArray(myPlayer.devCards) ? myPlayer.devCards : [];
  const pendingType = state.pendingAction?.type;

  const canBuildSettlement = canAfford(res, BUILDING_COSTS.settlement);
  const canBuildRoad = canAfford(res, BUILDING_COSTS.road);
  const canBuildCity = canAfford(res, BUILDING_COSTS.city);
  const canBuyDev = canAfford(res, BUILDING_COSTS.devCard) && state.devDeckSize > 0;

  const [costTooltip, setCostTooltip] = useState<string | null>(null);

  const handleEndTurn = () => {
    setBuildMode(null);
    setCostTooltip(null);
    onAction({ type: 'endTurn' });
  };

  const toggleBuild = (mode: string) => {
    setBuildMode(buildMode === mode ? null : mode);
  };

  /** Click handler for building buttons — toggle build mode if affordable, else show cost tooltip */
  const handleBuildClick = (mode: string, canAffordIt: boolean) => {
    if (canAffordIt) {
      setCostTooltip(null);
      toggleBuild(mode);
    } else {
      setCostTooltip(costTooltip === mode ? null : mode);
    }
  };

  const handleDevCardClick = () => {
    if (canBuyDev) {
      setCostTooltip(null);
      onAction({ type: 'buyDevCard' });
    } else {
      setCostTooltip(costTooltip === 'devCard' ? null : 'devCard');
    }
  };

  const tooltipInfo = costTooltip ? BUILDING_INFO[costTooltip] : null;

  return (
    <div className="catan-action-bar">
      <TurnTimer deadline={state.turnDeadline} />
      {/* Cost tooltip — floats above the action bar */}
      {tooltipInfo && (
        <div className="catan-cost-tooltip">
          <span className="catan-cost-tooltip-title">{tooltipInfo.emoji} {tooltipInfo.name}</span>
          <div className="catan-cost-tooltip-rows">
            {(Object.entries(tooltipInfo.cost) as [string, number][])
              .filter(([, need]) => need > 0)
              .map(([resource, need]) => {
                const have = res[resource as keyof Resources] ?? 0;
                const ok = have >= need;
                return (
                  <span key={resource} className={`catan-cost-row${ok ? ' ok' : ' missing'}`}>
                    {RESOURCE_EMOJI_BAR[resource]} {have}/{need}
                  </span>
                );
              })}
          </div>
          <button className="catan-cost-tooltip-close" onClick={() => setCostTooltip(null)}>✕</button>
        </div>
      )}

      {/* Actions section */}
      <div className="catan-bar-actions">
        {/* Dice-off phase */}
        {state.phase === 'diceOff' && (
          <span className="catan-bar-status">🎲 Kasta tärning för att avgöra startspelare</span>
        )}

        {/* Setup phase */}
        {isSetup && isMyTurn && (
          <span className="catan-bar-status">
            Placera {state.setupStep === 'settlement' ? 'bosättning' : 'väg'} på kartan
          </span>
        )}

        {/* Playing phase — not rolled yet: show waiting status (dice button is on the board) */}
        {isPlaying && isMyTurn && !pendingType && !state.diceRolled && (
          <span className="catan-bar-status">🎲 Kasta tärningen på brädet</span>
        )}

        {/* Playing phase — rolled, can build */}
        {isPlaying && isMyTurn && !pendingType && state.diceRolled && (
          <>
            <button
              className={`catan-bar-icon-btn${buildMode === 'settlement' ? ' active' : ''}${!canBuildSettlement ? ' cant-afford' : ''}`}
              onClick={() => handleBuildClick('settlement', canBuildSettlement)}
              title="Bosättning"
            >
              <IconSettlement />
            </button>
            <button
              className={`catan-bar-icon-btn${buildMode === 'road' ? ' active' : ''}${!canBuildRoad ? ' cant-afford' : ''}`}
              onClick={() => handleBuildClick('road', canBuildRoad)}
              title="Väg"
            >
              <IconRoad />
            </button>
            <button
              className={`catan-bar-icon-btn${buildMode === 'city' ? ' active' : ''}${!canBuildCity ? ' cant-afford' : ''}`}
              onClick={() => handleBuildClick('city', canBuildCity)}
              title="Stad"
            >
              <IconCity />
            </button>
            <button
              className={`catan-bar-icon-btn${!canBuyDev ? ' cant-afford' : ''}`}
              onClick={handleDevCardClick}
              title="Köp utvecklingskort"
            >
              <IconDevCard />
            </button>
            <button
              className="catan-bar-icon-btn"
              onClick={() => { setCostTooltip(null); onOpenTrade(); }}
              title="Handla"
            >
              <IconTrade />
            </button>
            {myDevCards.length > 0 && !myPlayer.devCardPlayedThisTurn && (
              <button
                className="catan-bar-icon-btn"
                onClick={onOpenDevCard}
                title="Spela utvecklingskort"
              >
                <IconPlayCard />
              </button>
            )}
            <button className="catan-bar-primary" onClick={handleEndTurn}>
              ✅ Avsluta tur
            </button>
          </>
        )}

        {/* Pending: moveRobber */}
        {pendingType === 'moveRobber' && isMyTurn && (
          <span className="catan-bar-status">Klicka på en hex för att flytta rövaren</span>
        )}

        {/* Pending: steal */}
        {pendingType === 'steal' && isMyTurn && (
          <>
            <span className="catan-bar-status">Stjäl från:</span>
            {state.pendingAction?.stealFrom?.map(pid => {
              const pp = state.players.find(p => p.id === pid);
              return pp ? (
                <button
                  key={pid}
                  className={`catan-bar-icon-btn player-${pp.color}`}
                  onClick={() => onAction({ type: 'steal', targetPlayerId: pid })}
                  title={pp.name}
                  style={{ width: 'auto', padding: '0 10px', fontSize: 13, fontWeight: 700 }}
                >
                  {pp.name}
                </button>
              ) : null;
            })}
          </>
        )}

        {/* Pending: placeRoad */}
        {pendingType === 'placeRoad' && isMyTurn && (
          <span className="catan-bar-status">
            Placera väg ({state.pendingAction?.roadsLeft} kvar)
          </span>
        )}

        {/* Pending: yearOfPlenty / monopoly */}
        {(pendingType === 'yearOfPlenty' || pendingType === 'monopoly') && isMyTurn && (
          <button className="catan-bar-primary" onClick={onOpenDevCard}>
            {pendingType === 'yearOfPlenty' ? '🎁 Välj resurser' : '💰 Välj resurs'}
          </button>
        )}

        {/* Not my turn */}
        {!isMyTurn && (
          <span className="catan-bar-status">
            ⏳ {state.players[state.currentPlayerIndex]?.name}s tur
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Main Game component ----
interface GameProps {
  state: ClientGameState;
  sendAction: (action: object) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  onLeave: () => void;
  gameId: string;
  token: string;
}

export function Game({ state, sendAction, sendChat, onLeave, gameId, token }: GameProps) {
  const [buildMode, setBuildMode] = useState<string | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [showDevCard, setShowDevCard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Dice animation state
  const [diceAnimPhase, setDiceAnimPhase] = useState<DiceAnimPhase>('idle');
  const [animDisplayDice, setAnimDisplayDice] = useState<[number, number]>([1, 1]);
  const diceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diceAnimPhaseRef = useRef<DiceAnimPhase>('idle');
  diceAnimPhaseRef.current = diceAnimPhase;
  // undefined = not yet initialised (skip animation on first mount)
  const prevDiceRef = useRef<[number, number] | null | undefined>(undefined);

  // Show result card for ALL players when dice change (not just the roller)
  useEffect(() => {
    const dice = state.dice;
    if (!dice) { prevDiceRef.current = null; return; }
    const [d1, d2] = dice;
    if (prevDiceRef.current === undefined) {
      // First mount — don't animate stale dice from a previous turn
      prevDiceRef.current = [d1, d2];
      return;
    }
    const prev = prevDiceRef.current;
    if (!prev || prev[0] !== d1 || prev[1] !== d2) {
      prevDiceRef.current = [d1, d2];
      // Only trigger if this client didn't already start the animation (i.e. not the roller)
      if (diceAnimPhaseRef.current === 'idle') {
        setDiceAnimPhase('showing');
        if (diceTimerRef.current) clearTimeout(diceTimerRef.current);
        diceTimerRef.current = setTimeout(() => setDiceAnimPhase('idle'), 2800);
      }
    }
  }, [state.dice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.chatMessages?.length]);

  // Auto-trigger forceEndTurn when the deadline has been past for 2 s.
  // Only one client needs to send it (server is idempotent on second attempt).
  // We pick the player whose ID sorts lowest to avoid duplicate calls.
  const deadline = state.turnDeadline;
  useEffect(() => {
    if (deadline === null) return;
    if (state.winner) return;
    const activeIds = state.diceOffActive ?? state.players.map(p => p.id);
    const sortedFirst = [...activeIds].sort()[0];
    if (state.myPlayerId !== sortedFirst) return; // only the "leader" client triggers
    const fireAt = deadline + 2000; // 2 s grace
    const ms = fireAt - Date.now();
    const trigger = () => {
      sendAction({ type: 'forceEndTurn' }).catch(() => { /* ignore — likely already advanced */ });
    };
    if (ms <= 0) {
      trigger();
      return;
    }
    const t = setTimeout(trigger, ms);
    return () => clearTimeout(t);
  }, [deadline, state.winner, state.myPlayerId, state.diceOffActive, state.players, sendAction]);


  const myPlayer: ClientPlayer | undefined = state.players.find(p => p.id === state.myPlayerId);
  if (!myPlayer) {
    return (
      <div className="catan-game-wrap">
        <p className="catan-muted">Ansluter…</p>
      </div>
    );
  }

  const isMyTurn = state.players[state.currentPlayerIndex]?.id === myPlayer.id;
  const pendingType = state.pendingAction?.type;

  // Compute valid placements
  let validVertices: string[] = [];
  let validEdges: string[] = [];
  let validHexes: string[] = [];

  if (isMyTurn) {
    if (state.phase === 'setup') {
      if (state.setupStep === 'settlement') {
        validVertices = getValidSettlementPlacements(state, myPlayer.id);
      } else {
        validEdges = getValidRoadPlacements(state, myPlayer.id);
      }
    } else if (state.phase === 'playing') {
      if (pendingType === 'moveRobber') {
        validHexes = getValidRobberHexes(state);
      } else if (pendingType === 'placeRoad') {
        validEdges = getValidRoadPlacements(state, myPlayer.id);
      } else if (buildMode === 'settlement') {
        validVertices = getValidSettlementPlacements(state, myPlayer.id);
      } else if (buildMode === 'road') {
        validEdges = getValidRoadPlacements(state, myPlayer.id);
      } else if (buildMode === 'city') {
        validVertices = getValidCityPlacements(state, myPlayer.id);
      }
    }
  }

  const dispatch = async (action: object) => {
    setActionError(null);
    try {
      await sendAction(action);
      setBuildMode(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  /** Roll dice with animation: shake → settle on result → hide after 2.8 s */
  const handleRollDice = async () => {
    if (diceAnimPhase !== 'idle') return;
    // Start shaking with random cycling faces
    setDiceAnimPhase('rolling');
    diceIntervalRef.current = setInterval(() => {
      setAnimDisplayDice([
        (Math.ceil(Math.random() * 6)) as 1|2|3|4|5|6,
        (Math.ceil(Math.random() * 6)) as 1|2|3|4|5|6,
      ]);
    }, 75);
    try {
      setActionError(null);
      await sendAction({ type: 'rollDice' });
      // Stop cycling, show real result with pop
      if (diceIntervalRef.current) { clearInterval(diceIntervalRef.current); diceIntervalRef.current = null; }
      setDiceAnimPhase('showing');
      diceTimerRef.current = setTimeout(() => setDiceAnimPhase('idle'), 2800);
    } catch (err) {
      if (diceIntervalRef.current) { clearInterval(diceIntervalRef.current); diceIntervalRef.current = null; }
      setDiceAnimPhase('idle');
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleVertexClick = (vertexId: string) => {
    if (!isMyTurn) return;
    if (state.phase === 'setup') {
      if (state.setupStep === 'settlement') {
        void dispatch({ type: 'placeSettlement', vertexId });
      }
    } else if (state.phase === 'playing') {
      if (buildMode === 'settlement') {
        // After placing a settlement, auto-enter road mode so valid spots are highlighted
        setActionError(null);
        sendAction({ type: 'buildSettlement', vertexId })
          .then(() => setBuildMode('road'))
          .catch(err => {
            setActionError(err instanceof Error ? err.message : String(err));
            setBuildMode(null);
          });
      } else if (buildMode === 'city') {
        void dispatch({ type: 'buildCity', vertexId });
      }
    }
  };

  const handleEdgeClick = (edgeId: string) => {
    if (!isMyTurn) return;
    if (state.phase === 'setup' && state.setupStep === 'road') {
      void dispatch({ type: 'placeRoad', edgeId });
    } else if (state.phase === 'playing' && (buildMode === 'road' || pendingType === 'placeRoad')) {
      void dispatch({ type: 'buildRoad', edgeId });
    }
  };

  const handleHexClick = (hexId: string) => {
    if (!isMyTurn) return;
    if (pendingType === 'moveRobber') {
      void dispatch({ type: 'moveRobber', hexId });
    }
  };

  const handleLeaveConfirmed = async () => {
    try {
      await fetch(`/api/catan/${gameId}/leave`, {
        method: 'POST',
        headers: { 'x-catan-token': token },
      });
    } catch {
      // ignore errors — still leave
    }
    onLeave();
  };

  const handleSendChat = async () => {
    const text = chatText.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    setChatText('');
    try {
      await sendChat(text);
    } catch {
      // silently ignore chat errors
    } finally {
      setChatSending(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSendChat();
    }
  };

  const recentMessages = (state.chatMessages ?? []).slice(-50);

  return (
    <div className="catan-game-wrap">
      {state.phase === 'ended' && state.winner && (
        <div className="catan-game-header">
          <span className="catan-winner-badge">
            🏆 {state.players.find(p => p.id === state.winner)?.name ?? 'Okänd'} vann!
          </span>
        </div>
      )}

      {/* ── Dice-off winner announcement ── */}
      {state.diceOffWinnerId && state.diceOffWinnerId !== dismissedWinnerId && (() => {
        const winner = state.players.find(p => p.id === state.diceOffWinnerId);
        if (!winner) return null;
        const isMe = winner.id === myPlayer.id;
        return (
          <div className="catan-error-overlay" onClick={() => setDismissedWinnerId(state.diceOffWinnerId!)}>
            <div className="catan-winner-modal" onClick={e => e.stopPropagation()}>
              <div className="catan-winner-modal-icon">🎲</div>
              <h2 className="catan-winner-modal-title">
                {isMe ? 'Du vann!' : `${winner.name} vann!`}
              </h2>
              <p className="catan-winner-modal-msg">
                {isMe ? 'Du får börja — placera din första bosättning.' : `${winner.name} får börja.`}
              </p>
              <button
                className="catan-btn catan-btn-primary catan-btn-sm"
                onClick={() => setDismissedWinnerId(state.diceOffWinnerId!)}
              >
                OK
              </button>
            </div>
          </div>
        );
      })()}

      {actionError && (
        <div className="catan-error-overlay" onClick={() => setActionError(null)}>
          <div className="catan-error-modal" onClick={e => e.stopPropagation()}>
            <div className="catan-error-modal-header">
              <span className="catan-error-modal-icon">⚠️</span>
              <span className="catan-error-modal-title">Något gick fel</span>
              <button className="catan-modal-close" onClick={() => setActionError(null)}>✕</button>
            </div>
            <p className="catan-error-modal-msg">{translateError(actionError)}</p>
          </div>
        </div>
      )}

      {/* ── Dice-off overlay popup ── */}
      {state.phase === 'diceOff' && state.diceOffRolls && (
        <div className="catan-error-overlay">
          <div className="catan-diceoff-modal" onClick={e => e.stopPropagation()}>
            <div className="catan-diceoff-modal-icon">🎲</div>
            <h2 className="catan-diceoff-modal-title">Vem börjar?</h2>
            {state.diceOffActive && state.diceOffActive.length < state.players.length && (
              <p className="catan-diceoff-modal-tiebreak">Oavgjort — kasta om!</p>
            )}
            <div className="catan-diceoff-rows">
              {state.players.map(p => {
                const roll = state.diceOffRolls![p.id];
                const isActive = state.diceOffActive?.includes(p.id);
                return (
                  <div key={p.id} className={`catan-diceoff-row${isActive ? ' active' : ''}`}>
                    <span className={`catan-player-dot player-${p.color}`} style={{ width: 12, height: 12, borderRadius: '50%', display: 'inline-block', background: 'var(--pc)' }} />
                    <span className="catan-diceoff-name">{p.id === myPlayer.id ? 'Du' : p.name}</span>
                    <span className="catan-diceoff-result">
                      {roll
                        ? `🎲 ${roll[0]} + ${roll[1]} = ${roll[0] + roll[1]}`
                        : isActive ? '⏳' : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            {state.diceOffActive?.includes(myPlayer.id) && !state.diceOffRolls[myPlayer.id] && (
              <button
                className="catan-btn catan-btn-primary"
                style={{ marginTop: 14, width: '100%' }}
                onClick={() => void dispatch({ type: 'diceOffRoll' })}
              >
                🎲 Kasta tärning
              </button>
            )}
            {state.diceOffActive?.includes(myPlayer.id) && state.diceOffRolls[myPlayer.id] && (
              <p className="catan-muted" style={{ marginTop: 10, fontSize: 13 }}>Väntar på de andra…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Trade offer card — sits above chat, always fully visible ── */}
      {state.tradeOffer && state.tradeOffer.fromPlayerId !== myPlayer.id && (() => {
        const offer = state.tradeOffer!;
        const from = state.players.find(p => p.id === offer.fromPlayerId);
        const myResponse = offer.responses[myPlayer.id];

        // After responding, show a compact one-liner — no need to keep the full card
        if (myResponse !== 'pending') {
          return (
            <div className="catan-trade-card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>🔄</span>
              <span style={{ fontSize: 13, color: 'var(--mute)', flex: 1 }}>
                {from?.name}: {myResponse === 'accept' ? 'accepterat ✅' : 'nekat ❌'} — väntar på värden
              </span>
            </div>
          );
        }

        return (
          <div className="catan-trade-card">
            <div className="catan-trade-card-header">
              <span className="catan-trade-card-icon">🔄</span>
              <span className="catan-trade-card-title">{from?.name} erbjuder ett byte</span>
            </div>
            <div className="catan-trade-card-resources">
              <span className="catan-trade-card-label">Ger</span>
              <span className="catan-trade-card-res">{formatResources(offer.give)}</span>
              <span className="catan-trade-card-arrow">→</span>
              <span className="catan-trade-card-label">Vill ha</span>
              <span className="catan-trade-card-res">{formatResources(offer.want)}</span>
            </div>
            <div className="catan-trade-card-actions">
              <button className="catan-btn catan-btn-primary catan-btn-sm"
                onClick={() => void dispatch({ type: 'tradeRespond', accept: true })}>
                ✅ Acceptera
              </button>
              <button className="catan-btn catan-btn-secondary catan-btn-sm"
                onClick={() => void dispatch({ type: 'tradeRespond', accept: false })}>
                ❌ Neka
              </button>
            </div>
          </div>
        );
      })()}

      {state.tradeOffer && state.tradeOffer.fromPlayerId === myPlayer.id && (() => {
        const offer = state.tradeOffer!;
        const acceptedPlayers = Object.entries(offer.responses)
          .filter(([, r]) => r === 'accept')
          .map(([pid]) => state.players.find(p => p.id === pid))
          .filter(Boolean) as ClientPlayer[];
        return (
          <div className="catan-trade-card catan-trade-card-mine">
            <div className="catan-trade-card-header">
              <span className="catan-trade-card-icon">🔄</span>
              <span className="catan-trade-card-title">Ditt erbjudande</span>
            </div>
            <div className="catan-trade-card-resources">
              <span className="catan-trade-card-label">Ger</span>
              <span className="catan-trade-card-res">{formatResources(offer.give)}</span>
              <span className="catan-trade-card-arrow">→</span>
              <span className="catan-trade-card-label">Vill ha</span>
              <span className="catan-trade-card-res">{formatResources(offer.want)}</span>
            </div>
            {acceptedPlayers.length > 0 ? (
              <div className="catan-trade-card-actions">
                {acceptedPlayers.map(p => (
                  <button key={p.id}
                    className={`catan-btn catan-btn-primary catan-btn-sm player-${p.color}`}
                    onClick={() => void dispatch({ type: 'tradeComplete', acceptingPlayerId: p.id })}>
                    Välj {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="catan-trade-card-status">Väntar på svar…</p>
            )}
            <button className="catan-btn catan-btn-ghost catan-btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => void dispatch({ type: 'tradeCancel' })}>
              Avbryt handel
            </button>
          </div>
        );
      })()}

      {/* Chat panel */}
      <div className="catan-chat-wrap">
        <div className="catan-chat-room-line">Rum <span className="catan-chat-room-code">#{state.code}</span></div>
        <div className="catan-chat-messages" ref={chatMessagesRef}>
          {recentMessages.length === 0 ? (
            <p className="catan-chat-empty">Inga meddelanden än…</p>
          ) : (
            recentMessages.map((msg, i) => (
              <div
                key={`${msg.ts}-${i}`}
                className={`catan-chat-msg${msg.system ? ' system' : ''}`}
              >
                {!msg.system && (
                  <span className="catan-chat-name">{msg.playerName}: </span>
                )}
                {msg.text}
              </div>
            ))
          )}
        </div>
        <div className="catan-chat-input-row">
          <input
            ref={chatInputRef}
            className="catan-chat-input"
            type="text"
            placeholder="Skriv ett meddelande…"
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            onKeyDown={handleChatKeyDown}
            maxLength={200}
          />
          <button
            className="catan-chat-send"
            onClick={() => void handleSendChat()}
            disabled={chatSending || !chatText.trim()}
          >
            Skicka
          </button>
        </div>
      </div>

      {/* Board — full width, no sidebar */}
      <Board
        state={state}
        myPlayerId={myPlayer.id}
        onRollDice={isMyTurn && state.phase === 'playing' && !state.diceRolled && diceAnimPhase === 'idle'
          ? () => void handleRollDice()
          : undefined}
        diceAnimPhase={diceAnimPhase}
        animDisplayDice={animDisplayDice}
        validVertices={validVertices}
        validEdges={validEdges}
        validHexes={validHexes}
        onVertexClick={handleVertexClick}
        onEdgeClick={handleEdgeClick}
        onHexClick={handleHexClick}
      />

      {/* Fixed action bar — always visible */}
      <ActionBar
        state={state}
        myPlayer={myPlayer}
        buildMode={buildMode}
        setBuildMode={setBuildMode}
        onAction={(action) => void dispatch(action)}
        onOpenTrade={() => setShowTrade(true)}
        onOpenDevCard={() => setShowDevCard(true)}
      />

      {/* Leave button below the action bar */}
      <div className="catan-leave-btn-wrap">
        <button
          className="catan-btn catan-btn-ghost catan-btn-sm catan-leave-btn"
          onClick={() => setShowLeaveConfirm(true)}
        >
          Lämna spel
        </button>
      </div>

      {/* Modals */}
      {showTrade && (
        <TradeModal
          state={state}
          myPlayer={myPlayer}
          onAction={(action) => void dispatch(action)}
          onClose={() => setShowTrade(false)}
        />
      )}

      {showDevCard && Array.isArray(myPlayer.devCards) && (
        <DevCardModal
          devCards={myPlayer.devCards}
          devCardPlayedThisTurn={myPlayer.devCardPlayedThisTurn}
          diceRolled={state.diceRolled}
          onAction={(action) => void dispatch(action)}
          onClose={() => setShowDevCard(false)}
        />
      )}

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="catan-confirm-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="catan-confirm-card" onClick={e => e.stopPropagation()}>
            <p className="catan-confirm-text">Är du säker på att du vill lämna spelet?</p>
            <div className="catan-confirm-actions">
              <button
                className="catan-btn catan-btn-secondary catan-btn-sm"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Avbryt
              </button>
              <button
                className="catan-btn catan-btn-primary catan-btn-sm catan-confirm-leave-btn"
                onClick={() => void handleLeaveConfirmed()}
              >
                Ja, lämna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
