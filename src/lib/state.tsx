import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Friend, TierId } from '../data/friends';
import { ApiError, api, tokenStore, type ApiGMap, type ApiPrediction } from './api';

interface FriendsListState {
  // Loading + error surface for the initial fetch.
  loading: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;

  // Friend records and helpers (formerly imported from data/friends.ts).
  friends: Friend[];
  findFriend: (id: string) => Friend | undefined;
  friendsByTier: (tier: TierId) => Friend[];

  // Predictions.
  predictions: ApiPrediction[];
  submitPrediction: (input: { guesser: string; friendId: string; text: string }) => Promise<void>;
  toggleCorrect: (id: number, current: boolean) => Promise<void>;

  // G Map (computed server-side from geocoded addresses).
  gmap: ApiGMap | null;

  // Admin auth.
  isAdmin: boolean;
  loginError: string | null;
  tryLogin: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Admin mutations against friends.
  updateFriend: (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string; lat?: number | null; lon?: number | null }) => Promise<void>;
  uploadPhoto: (id: string, dataUrl: string) => Promise<void>;
  deletePhoto: (id: string, position: number) => Promise<void>;

  // Job leaderboard.
  jobLeaderboard: string[];  // ordered array of friend ids, position = index+1
  updateJobLeaderboard: (order: string[]) => Promise<void>;
}

const Ctx = createContext<FriendsListState | null>(null);

export function FriendsListProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [predictions, setPredictions] = useState<ApiPrediction[]>([]);
  const [gmap, setGmap] = useState<ApiGMap | null>(null);
  const [jobLeaderboard, setJobLeaderboard] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Used so we can disambiguate between "haven't checked yet" and "actively
  // an admin" when restoring a token from localStorage on first load.
  const sessionChecked = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [f, p, g, jl] = await Promise.all([
        api.fetchFriends(),
        api.fetchPredictions(),
        api.fetchGMap(),
        api.fetchJobLeaderboard(),
      ]);
      setFriends(f);
      setPredictions(p);
      setGmap(g);
      setJobLeaderboard(jl.map(r => r.friendId));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + admin session restore.
  useEffect(() => {
    refresh();
    if (sessionChecked.current) return;
    sessionChecked.current = true;
    if (tokenStore.get()) {
      api.checkSession().then(
        () => setIsAdmin(true),
        () => { tokenStore.clear(); setIsAdmin(false); },
      );
    }
  }, [refresh]);

  // Body class drives admin-mode CSS on cards (contenteditable hover, etc.).
  useEffect(() => {
    document.body.classList.toggle('admin-mode', isAdmin);
    return () => document.body.classList.remove('admin-mode');
  }, [isAdmin]);

  const findFriend = useCallback((id: string) => friends.find(f => f.id === id), [friends]);
  const friendsByTier = useCallback(
    (tier: TierId) => friends.filter(f => f.tier === tier),
    [friends],
  );

  const tryLogin = useCallback(async (password: string) => {
    setLoginError(null);
    try {
      const { token } = await api.login(password);
      tokenStore.set(token);
      setIsAdmin(true);
      return true;
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'inloggning misslyckades');
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* token already invalid is fine */ }
    tokenStore.clear();
    setIsAdmin(false);
    setLoginError(null);
  }, []);

  const submitPrediction = useCallback(
    async (input: { guesser: string; friendId: string; text: string }) => {
      const created = await api.submitPrediction(input);
      setPredictions(prev => [created, ...prev]);
    },
    [],
  );

  const toggleCorrect = useCallback(async (id: number, current: boolean) => {
    const updated = await api.markCorrect(id, !current);
    setPredictions(prev => prev.map(p => (p.id === id ? updated : p)));
  }, []);

  const updateFriend = useCallback(
    async (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string; lat?: number | null; lon?: number | null }) => {
      const updated = await api.updateFriend(id, patch);
      setFriends(prev => prev.map(f => (f.id === id ? updated : f)));
    },
    [],
  );

  const updateJobLeaderboard = useCallback(async (order: string[]) => {
    const rows = await api.updateJobLeaderboard(order);
    setJobLeaderboard(rows.map(r => r.friendId));
  }, []);

  const uploadPhoto = useCallback(async (id: string, dataUrl: string) => {
    const updated = await api.uploadPhoto(id, dataUrl);
    setFriends(prev => prev.map(f => (f.id === id ? updated : f)));
  }, []);

  const deletePhoto = useCallback(async (id: string, position: number) => {
    const updated = await api.deletePhoto(id, position);
    setFriends(prev => prev.map(f => (f.id === id ? updated : f)));
  }, []);

  const value = useMemo<FriendsListState>(
    () => ({
      loading, loadError, refresh,
      friends, findFriend, friendsByTier,
      predictions, submitPrediction, toggleCorrect,
      gmap,
      isAdmin, loginError, tryLogin, logout,
      updateFriend, uploadPhoto, deletePhoto,
      jobLeaderboard, updateJobLeaderboard,
    }),
    [
      loading, loadError, refresh,
      friends, findFriend, friendsByTier,
      predictions, submitPrediction, toggleCorrect,
      gmap,
      isAdmin, loginError, tryLogin, logout,
      updateFriend, uploadPhoto, deletePhoto,
      jobLeaderboard, updateJobLeaderboard,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFriendsList(): FriendsListState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFriendsList must be used inside <FriendsListProvider>');
  return v;
}
