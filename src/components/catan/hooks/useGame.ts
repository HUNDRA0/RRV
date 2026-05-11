import { useEffect, useRef, useState } from 'react';
import type { ClientGameState } from '../types';

const BASE = '/api/catan';

export function useGame(gameId: string | null, token: string | null) {
  const [state, setState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updatedAtRef = useRef(0);
  const stateRef = useRef<ClientGameState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    if (!gameId || !token) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled || document.visibilityState === 'hidden') return;
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

    // Backup heartbeat — picks up state changes from other players' actions.
    // Primary state updates come from sendAction/sendChat responses (instant).
    // Playing: 3s so the next player sees the new turn within a few seconds
    // Setup/lobby phase: 5s (waiting for others to place / host to start)
    // Winner set: stop entirely
    function schedule() {
      if (cancelled) return;
      const phase = stateRef.current?.phase;
      const winner = stateRef.current?.winner;
      if (winner) return; // game over
      const ms = phase === 'playing' ? 3_000 : 5_000;
      timer = setTimeout(async () => {
        await poll();
        schedule();
      }, ms);
    }

    // One poll on mount to get initial state, then schedule heartbeat
    void poll().then(schedule);

    // Sync immediately whenever the user switches back to the tab
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (timer) { clearTimeout(timer); timer = null; }
        void poll().then(schedule);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [gameId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // sendAction — returns new state immediately, no poll needed afterwards
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

  // sendChat — returns new state immediately (chat messages visible at once)
  async function sendChat(text: string): Promise<void> {
    if (!gameId || !token) return;
    const res = await fetch(`${BASE}/${gameId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-catan-token': token },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const data = await res.json() as ClientGameState;
    updatedAtRef.current = data.updatedAt;
    setState(data);
  }

  return { state, error, sendAction, sendChat };
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
