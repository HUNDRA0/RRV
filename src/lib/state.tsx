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
import { ApiError, api, tokenStore, type ApiGMap, type ApiPrediction, type SiteContent, type BootstrapPayload } from './api';

interface FriendsListState {
  // Loading + error surface for the initial fetch.
  loading: boolean;
  loadError: string | null;
  refresh: (force?: boolean) => Promise<void>;

  // Friend records and helpers (formerly imported from data/friends.ts).
  friends: Friend[];
  findFriend: (id: string) => Friend | undefined;
  friendsByTier: (tier: TierId) => Friend[];

  // Predictions.
  predictions: ApiPrediction[];
  submitPrediction: (input: { guesser: string; friendId: string; text: string }) => Promise<void>;
  toggleCorrect: (id: number, current: boolean) => Promise<void>;
  deletePrediction: (id: number) => Promise<void>;

  // G Map (computed server-side from geocoded addresses).
  gmap: ApiGMap | null;

  // Admin auth.
  isAdmin: boolean;
  loginError: string | null;
  tryLogin: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;

  // Site content (CMS).
  siteContent: SiteContent;
  updateContent: (key: string, value: string) => Promise<void>;

  // Today's quote — picked server-side so it's stable for the whole UTC day.
  dailyQuote: string;

  // Edit mode — separate from isAdmin so admin can browse without affordances.
  isEditMode: boolean;
  isEditing: boolean;  // convenience: isAdmin && isEditMode
  toggleEditMode: () => void;

  // Admin mutations against friends.
  updateFriend: (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string; lat?: number; lon?: number; tier?: string; rank?: number }) => Promise<void>;
  swapFriends: (idA: string, idB: string) => Promise<void>;
  uploadPhoto: (id: string, dataUrl: string) => Promise<void>;
  deletePhoto: (id: string, position: number) => Promise<void>;
}

const Ctx = createContext<FriendsListState | null>(null);

// Module-level timestamp — survives re-renders but resets on hard page refresh.
let lastFetch = 0;
const FETCH_TTL = 60_000;

export function FriendsListProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [predictions, setPredictions] = useState<ApiPrediction[]>([]);
  const [gmap, setGmap] = useState<ApiGMap | null>(null);
  const [siteContent, setSiteContent] = useState<SiteContent>({});
  const [dailyQuote, setDailyQuote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Used so we can disambiguate between "haven't checked yet" and "actively
  // an admin" when restoring a token from localStorage on first load.
  const sessionChecked = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (!force && Date.now() - lastFetch < FETCH_TTL) return;
    setLoading(true);
    setLoadError(null);
    try {
      // Consume the early fetch started in index.html (breaks JS waterfall).
      // Only used once — cleared immediately so subsequent refreshes go via API.
      const earlyFetch = (window as Window & { __bootstrap?: Promise<BootstrapPayload> }).__bootstrap;
      if (earlyFetch) {
        delete (window as Window & { __bootstrap?: Promise<BootstrapPayload> }).__bootstrap;
      }
      const { friends: f, predictions: p, gmap: g, content: c, dailyQuote: dq } =
        earlyFetch ? await earlyFetch : await api.fetchBootstrap() as BootstrapPayload;
      setFriends(f);
      setPredictions(p);
      setGmap(g);
      setSiteContent(c);
      if (dq) setDailyQuote(dq);
      lastFetch = Date.now();
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

  // admin-mode body class drives all edit affordances — only active when
  // logged in AND the edit mode toggle is on.
  const isEditing = isAdmin && isEditMode;
  useEffect(() => {
    document.body.classList.toggle('admin-mode', isEditing);
    return () => document.body.classList.remove('admin-mode');
  }, [isEditing]);

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
    setIsEditMode(false);
    setLoginError(null);
  }, []);

  const toggleEditMode = useCallback(() => setIsEditMode(v => !v), []);

  const updateContent = useCallback(async (key: string, value: string) => {
    const updated = await api.updateContent(key, value);
    setSiteContent(prev => ({ ...prev, [updated.key]: updated.value }));
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

  const deletePrediction = useCallback(async (id: number) => {
    await api.deletePrediction(id);
    setPredictions(prev => prev.filter(p => p.id !== id));
  }, []);

  const updateFriend = useCallback(
    async (id: string, patch: { name?: string; note?: string; bio?: string; currentMove?: string; lat?: number; lon?: number; tier?: string; rank?: number }) => {
      const updated = await api.updateFriend(id, patch);
      setFriends(prev => prev.map(f => (f.id === id ? updated : f)));
    },
    [],
  );

  const swapFriends = useCallback(async (idA: string, idB: string) => {
    await api.swapFriends(idA, idB);
    // Refresh full list so both friends get updated ranks/tiers
    const fresh = await api.fetchFriends();
    setFriends(fresh);
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
      predictions, submitPrediction, toggleCorrect, deletePrediction,
      gmap,
      siteContent, updateContent, dailyQuote,
      isAdmin, isEditMode, isEditing, toggleEditMode, loginError, tryLogin, logout,
      updateFriend, swapFriends, uploadPhoto, deletePhoto,
    }),
    [
      loading, loadError, refresh,
      friends, findFriend, friendsByTier,
      predictions, submitPrediction, toggleCorrect, deletePrediction,
      gmap,
      siteContent, updateContent, dailyQuote,
      isAdmin, isEditMode, isEditing, toggleEditMode, loginError, tryLogin, logout,
      updateFriend, swapFriends, uploadPhoto, deletePhoto,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFriendsList(): FriendsListState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFriendsList must be used inside <FriendsListProvider>');
  return v;
}
