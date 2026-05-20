// Social-media platform metadata.
//
// `buildLinks` converts a stored handle into:
//   - web URL (always works)
//   - mobile app deep-link (instagram://, fb://, tg://, etc.) — used on mobile
//     so the native app opens if installed.
//
// A handle can be either:
//   - just a username, e.g. "jacob.s"
//   - a full URL, e.g. "https://www.instagram.com/jacob.s/"
// We try to extract the bare username for the deep-link in both cases.

export type SocialPlatform =
  | 'instagram' | 'facebook' | 'linkedin' | 'x' | 'tiktok'
  | 'github' | 'youtube' | 'snapchat' | 'discord' | 'twitch'
  | 'threads' | 'website';

export interface SocialEntry {
  platform: SocialPlatform;
  handle: string;
}

interface PlatformMeta {
  label: string;
  color: string;
  // Build web URL from a normalized username/handle.
  web: (h: string) => string;
  // Build a mobile deep-link. Return null if no app scheme exists.
  app: ((h: string) => string) | null;
  // Inline SVG path data (24x24 viewBox), fillable via currentColor.
  iconPath: string;
}

// Strip URL prefixes so we get back to "jacob.s" etc.
function normalizeHandle(platform: SocialPlatform, raw: string): string {
  const trimmed = raw.trim().replace(/^@/, '');
  // If it's a full URL, peel out the path segment that's the username.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      // For linkedin: /in/<handle>
      if (platform === 'linkedin' && path.startsWith('in/')) return path.slice(3).split('/')[0];
      // For youtube: /@handle or /channel/UCxxx or /c/name
      if (platform === 'youtube') {
        if (path.startsWith('@')) return path.slice(1).split('/')[0];
        return path.split('/').pop() ?? path;
      }
      // Default: first path segment
      return path.split('/')[0];
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export const PLATFORMS: Record<SocialPlatform, PlatformMeta> = {
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    web: (h) => `https://www.instagram.com/${encodeURIComponent(normalizeHandle('instagram', h))}/`,
    app: (h) => `instagram://user?username=${encodeURIComponent(normalizeHandle('instagram', h))}`,
    iconPath: 'M12 2.2c-2.7 0-3 0-4.1.1-1 0-1.8.2-2.4.5a4.8 4.8 0 0 0-1.8 1.1A4.8 4.8 0 0 0 2.6 5.7c-.3.6-.5 1.4-.5 2.4-.1 1.1-.1 1.4-.1 4.1s0 3 .1 4.1c0 1 .2 1.8.5 2.4.3.7.7 1.3 1.1 1.8.5.5 1 .8 1.8 1.1.6.3 1.4.5 2.4.5 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c1 0 1.8-.2 2.4-.5.7-.3 1.3-.7 1.8-1.1.5-.5.8-1 1.1-1.8.3-.6.5-1.4.5-2.4.1-1.1.1-1.4.1-4.1s0-3-.1-4.1c0-1-.2-1.8-.5-2.4a4.8 4.8 0 0 0-1.1-1.8 4.8 4.8 0 0 0-1.8-1.1c-.6-.3-1.4-.5-2.4-.5C15 2.2 14.7 2.2 12 2.2Zm0 1.8c2.6 0 3 0 4 .1.9 0 1.5.2 1.8.3.5.2.8.4 1.1.7.3.3.5.6.7 1.1.1.3.3.9.3 1.8 0 1 .1 1.4.1 4s0 3-.1 4c0 .9-.2 1.5-.3 1.8-.2.5-.4.8-.7 1.1-.3.3-.6.5-1.1.7-.3.1-.9.3-1.8.3-1 0-1.4.1-4 .1s-3 0-4-.1c-.9 0-1.5-.2-1.8-.3a3 3 0 0 1-1.1-.7 3 3 0 0 1-.7-1.1c-.1-.3-.3-.9-.3-1.8 0-1-.1-1.4-.1-4s0-3 .1-4c0-.9.2-1.5.3-1.8.2-.5.4-.8.7-1.1.3-.3.6-.5 1.1-.7.3-.1.9-.3 1.8-.3 1 0 1.4-.1 4-.1Zm0 3.1a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8Zm0 8.1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm6.2-8.3a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0Z',
  },
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    web: (h) => `https://www.facebook.com/${encodeURIComponent(normalizeHandle('facebook', h))}`,
    app: (h) => `fb://profile/${encodeURIComponent(normalizeHandle('facebook', h))}`,
    iconPath: 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z',
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    web: (h) => `https://www.linkedin.com/in/${encodeURIComponent(normalizeHandle('linkedin', h))}/`,
    app: (h) => `linkedin://in/${encodeURIComponent(normalizeHandle('linkedin', h))}`,
    iconPath: 'M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14ZM8.3 18.3V10H5.7v8.3h2.6Zm-1.3-9.4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM18.3 18.3V13.6c0-2.5-1.4-3.7-3.2-3.7-1.5 0-2.2.8-2.6 1.4V10h-2.6c0 .7 0 8.3 0 8.3h2.6V14c0-.3 0-.5.1-.7.2-.5.6-1 1.4-1 1 0 1.5.7 1.5 1.8v4.3h2.6Z',
  },
  x: {
    label: 'X',
    color: '#000000',
    web: (h) => `https://x.com/${encodeURIComponent(normalizeHandle('x', h))}`,
    app: (h) => `twitter://user?screen_name=${encodeURIComponent(normalizeHandle('x', h))}`,
    iconPath: 'M18.3 2H21l-7.4 8.5L22.2 22h-6.7l-5.3-7-6 7H1.5l8-9.1L1.5 2h6.9l4.8 6.4L18.3 2Zm-2.4 18.2h1.9L7.3 3.7H5.3l10.6 16.5Z',
  },
  tiktok: {
    label: 'TikTok',
    color: '#000000',
    web: (h) => `https://www.tiktok.com/@${encodeURIComponent(normalizeHandle('tiktok', h))}`,
    app: (h) => `snssdk1233://user/profile/${encodeURIComponent(normalizeHandle('tiktok', h))}`,
    iconPath: 'M16.6 5.8a4.7 4.7 0 0 1-3-1.6h-2.8v11a2.5 2.5 0 1 1-2.5-2.5v-2.7a5.2 5.2 0 1 0 5.2 5.2v-5.5a7.4 7.4 0 0 0 4.4 1.4V8.3a4.7 4.7 0 0 1-1.3-2.5Z',
  },
  github: {
    label: 'GitHub',
    color: '#181717',
    web: (h) => `https://github.com/${encodeURIComponent(normalizeHandle('github', h))}`,
    app: null,
    iconPath: 'M12 2A10 10 0 0 0 8.8 21.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7 0-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A10 10 0 0 0 12 2Z',
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    web: (h) => `https://www.youtube.com/@${encodeURIComponent(normalizeHandle('youtube', h))}`,
    app: (h) => `youtube://www.youtube.com/@${encodeURIComponent(normalizeHandle('youtube', h))}`,
    iconPath: 'M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5C.6 9.5.6 12 .6 12s0 2.5.4 4.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1c.4-2 .4-4.5.4-4.5s0-2.5-.4-4.5Zm-13.1 7.3V8.2L15.5 12l-5.6 2.8Z',
  },
  snapchat: {
    label: 'Snapchat',
    color: '#FFFC00',
    web: (h) => `https://www.snapchat.com/add/${encodeURIComponent(normalizeHandle('snapchat', h))}`,
    app: (h) => `snapchat://add/${encodeURIComponent(normalizeHandle('snapchat', h))}`,
    iconPath: 'M12 2c3.4 0 5.6 2.4 5.6 5.5 0 .3 0 1.4-.1 2.4l.1.1c.4.2.8.3 1.2.3.6 0 1-.2 1.1-.2.3 0 .6.2.7.5.1.5-.4.7-1.1 1l-.4.2c-.3.1-1 .4-1.1.6 0 .1 0 .3.1.6.3.6 1 1.5 2 1.8.2 0 .3.2.3.4 0 .6-1.6 1.1-2 1.2-.1 0-.1.1-.2.3 0 .2-.1.4-.2.6-.1.1-.2.2-.4.2h-.2c-.2 0-.5-.1-.8-.1-.3 0-.5 0-.8.1-.6.1-1 .4-1.7 1-.4.3-1.4 1-2.9 1-1.5 0-2.5-.7-2.9-1-.7-.5-1.1-.8-1.7-1-.3-.1-.5-.1-.8-.1-.3 0-.6.1-.8.1h-.2c-.2 0-.3-.1-.4-.2-.1-.2-.2-.4-.2-.6 0-.2-.1-.3-.2-.3-.4-.1-2-.6-2-1.2 0-.2.1-.4.3-.4 1-.3 1.7-1.2 2-1.8.1-.3.1-.5.1-.6-.1-.2-.8-.5-1.1-.6l-.4-.2c-.7-.3-1.2-.5-1.1-1 .1-.3.4-.5.7-.5l1.1.2c.4 0 .8-.1 1.2-.3l.1-.1c-.1-1-.1-2.1-.1-2.4C6.4 4.4 8.6 2 12 2Z',
  },
  discord: {
    label: 'Discord',
    color: '#5865F2',
    web: (h) => `https://discord.com/users/${encodeURIComponent(normalizeHandle('discord', h))}`,
    app: null,
    iconPath: 'M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.3a14.3 14.3 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4 21 21 0 0 0-3.6 14 19.9 19.9 0 0 0 6 3 14.6 14.6 0 0 0 1.3-2 12.8 12.8 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.7 12.7 0 0 1-2 1c.4.7.8 1.4 1.3 2a19.9 19.9 0 0 0 6-3 21 21 0 0 0-3.6-14ZM8.5 15.3c-1.2 0-2.2-1.1-2.2-2.5 0-1.4 1-2.5 2.2-2.5 1.2 0 2.2 1.1 2.2 2.5 0 1.4-1 2.5-2.2 2.5Zm7 0c-1.2 0-2.2-1.1-2.2-2.5 0-1.4 1-2.5 2.2-2.5 1.2 0 2.2 1.1 2.2 2.5 0 1.4-1 2.5-2.2 2.5Z',
  },
  twitch: {
    label: 'Twitch',
    color: '#9146FF',
    web: (h) => `https://www.twitch.tv/${encodeURIComponent(normalizeHandle('twitch', h))}`,
    app: (h) => `twitch://stream/${encodeURIComponent(normalizeHandle('twitch', h))}`,
    iconPath: 'M2.1 5 4 1.6h17.5v12.3l-5 5h-3.9l-2.6 2.5H7.3V19H2.1V5Zm2 1.5v11h3.4v2.5h2L11.9 17h4l3.5-3.5V6.5H4.1Zm11.6 1.6h-2v4.7h2V8.1Zm-5.4 0h-2v4.7h2V8.1Z',
  },
  threads: {
    label: 'Threads',
    color: '#000000',
    web: (h) => `https://www.threads.net/@${encodeURIComponent(normalizeHandle('threads', h))}`,
    app: (h) => `barcelona://user?username=${encodeURIComponent(normalizeHandle('threads', h))}`,
    iconPath: 'M12.2 2C7.4 2 4 5 4 9.7c0 4.7 3.5 7.7 8.2 7.7 1.7 0 3.2-.4 4.3-1.1l-.7-1.4c-.9.5-2.1.9-3.5.9-3.6 0-6.2-2.2-6.2-6 0-3.7 2.5-6.1 6.1-6.1 3.5 0 5.6 1.9 6 4.7H17l-.1.5c-.4 1.5-1.8 2.3-3.5 2.3-1.5 0-2.5-.7-2.5-1.8 0-1 .7-1.6 2.3-1.6.7 0 1.4.1 2 .3v-1.5a8 8 0 0 0-2.1-.3c-2.7 0-4.1 1.4-4.1 3.2 0 2 1.6 3.2 3.9 3.2 2.4 0 4.4-1.2 5-3.3.5-1.7-.2-3.5-1.4-4.6C15.7 2.6 14 2 12.2 2Z',
  },
  website: {
    label: 'Hemsida',
    color: '#6b7280',
    web: (h) => {
      const t = h.trim();
      if (/^https?:\/\//i.test(t)) return t;
      return `https://${t}`;
    },
    app: null,
    iconPath: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-2.7c-.1-1.5-.4-3-.8-4.3a8 8 0 0 1 3.5 4.3ZM12 4c.8 0 2 1.3 2.4 4.5L12 9l-2.4-.5C10 5.3 11.2 4 12 4ZM5.1 11a8 8 0 0 1 3.5-4.3c-.4 1.3-.7 2.8-.8 4.3H5.1Zm0 2h2.7c.1 1.5.4 3 .8 4.3a8 8 0 0 1-3.5-4.3ZM12 20c-.8 0-2-1.3-2.4-4.5L12 15l2.4.5C14 18.7 12.8 20 12 20Zm0-7-2.5-.5C9.7 11 10 10 10 9l2 .5 2-.5c.1 1 .3 2 .5 3.5L12 13Zm3.4 4.3c.4-1.3.7-2.8.8-4.3h2.7a8 8 0 0 1-3.5 4.3Z',
  },
};

export function platformsList(): SocialPlatform[] {
  return Object.keys(PLATFORMS) as SocialPlatform[];
}

// Decide whether to use the app deep-link or web URL.
// On mobile, prefer the deep-link if it exists. Fall back to web after a delay
// in case the app isn't installed (handled by the link click handler).
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function buildPrimaryUrl(p: SocialPlatform, handle: string): string {
  const meta = PLATFORMS[p];
  if (isMobile() && meta.app) return meta.app(handle);
  return meta.web(handle);
}

export function buildWebUrl(p: SocialPlatform, handle: string): string {
  return PLATFORMS[p].web(handle);
}
