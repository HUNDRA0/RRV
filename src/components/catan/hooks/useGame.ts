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

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`${BASE}/${gameId}`, {
          headers: { 'x-catan-token': token! },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          setError(body.error ?? `HTTP ${res.status}`);
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

    void poll();
    const interval = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gameId, token]);

  async function sendAction(action: object): Promise<void> {
    if (!gameId || !token) throw new Error('No active game');
    const res = await fetch(`${BASE}/${gameId}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-catan-token': token,
      },
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
  // First resolve code to gameId
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
