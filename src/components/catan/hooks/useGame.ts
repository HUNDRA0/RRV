import { useEffect, useRef, useState } from 'react';
import type { ClientGameState } from '../types';

const BASE = '/api/catan';

// Lobby: 5 s — just waiting for players to join, not time-sensitive
// Playing: 3 s — turn-based, still comfortable
// Ended: stop polling entirely
function pollInterval(phase: string | undefined, winner: string | null | undefined): number | null {
  if (winner) return null;          // game over — no more reads needed
  if (phase === 'playing') return 3000;
  return 5000;                      // lobby / setup
}

export function useGame(gameId: string | null, token: string | null) {
  const [state, setState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updatedAtRef = useRef(0);
  // Keep a ref to the latest state so the interval callback can read it
  const stateRef = useRef<ClientGameState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    if (!gameId || !token) return;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      // Skip the network hit when the tab is hidden (phone locked, switched app).
      if (document.visibilityState === 'hidden') return;

      try {
        const res = await fetch(`${BASE}/${gameId}`, {
          headers: { 'x-catan-token': token! },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          if (!cancelled) setError(body.error ?? `HTTP ${res.status}`);
          return;
        }
        const data = await res.json() as ClientGameState;
        if (cancelled) return;
        if (data.updatedAt !== updatedAtRef.current) {
          updatedAtRef.current = data.updatedAt;
          setState(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    // Self-scheduling poll loop — adjusts interval dynamically based on game phase
    let timer: ReturnType<typeof setTimeout> | null = null;

    function schedule() {
      if (cancelled) return;
      const ms = pollInterval(stateRef.current?.phase, stateRef.current?.winner);
      if (ms === null) return; // game ended, stop scheduling
      timer = setTimeout(async () => {
        await poll();
        schedule(); // reschedule after each completed poll
      }, ms);
    }

    // First poll immediately, then start scheduling
    void poll().then(schedule);

    // Re-poll immediately when the user comes back to the tab
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [gameId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendAction(action: object): Promise<void> {
    if (!gameId || !token) throw new Error('No active game');
    const res = await fetch(`${BASE}/${gameId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-catan-token': token },
      body: JSON.stringify(action),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const data = await res.json() as ClientGameState;
    updatedAtRef.current = data.updatedAt;
    setState(data);
  }

  return { state, error, sendAction };
}

export async function createGame(name: string): Promise<{ gameId: string; token: string; code: string }> {
  const res = await fetch(`${BASE}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ gameId: string; token: string; code: string }>;
}

export async function joinGame(code: string, name: string): Promise<{ gameId: string; token: string }> {
  const codeRes = await fetch(`${BASE}/by-code/${code.toUpperCase()}`);
  if (!codeRes.ok) {
    const body = await codeRes.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Ogiltigt rumskod');
  }
  const { gameId } = await codeRes.json() as { gameId: string };

  const res = await fetch(`${BASE}/${gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { token: string };
  return { gameId, token: data.token };
}

export async function startGame(gameId: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/${gameId}/start`, {
    method: 'POST',
    headers: { 'x-catan-token': token },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}
