import { useEffect, useRef, useState } from 'react';
import type { ClientGameState } from '../types';

const BASE = '/api/catan';

export function useGame(gameId: string | null, token: string | null) {
  const [state, setState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updatedAtRef = useRef(0);

  useEffect(() => {
    if (!gameId || !token) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    // Long-poll loop: sends ?since=<updatedAt> so the server holds the connection
    // for up to 7 s if nothing has changed (2 DB reads per cycle vs constant timer reads).
    // Primary state updates still come instantly via sendAction/sendChat responses.
    async function longPoll() {
      if (cancelled || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const since = updatedAtRef.current;
        const res = await fetch(`${BASE}/${gameId}?since=${since}`, {
          headers: { 'x-catan-token': token! },
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          if (!cancelled) setError(body.error ?? `HTTP ${res.status}`);
          // Back off 5 s on error before retrying
          if (!cancelled) retryTimer = setTimeout(() => { retryTimer = null; void longPoll(); }, 5000);
          return;
        }
        const data = await res.json() as ClientGameState;
        if (cancelled) return;
        if (data.updatedAt !== updatedAtRef.current) {
          updatedAtRef.current = data.updatedAt;
          setState(data);
          setError(null);
        }
        if (!data.winner) void longPoll(); // chain immediately — server will hold next request
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          retryTimer = setTimeout(() => { retryTimer = null; void longPoll(); }, 5000);
        }
      } finally {
        inFlight = false;
      }
    }

    void longPoll();

    // Resume immediately when tab becomes visible (server hold was skipped while hidden)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !inFlight) void longPoll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
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
