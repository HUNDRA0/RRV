// Shared helpers for handling photo data-URLs (used by both seed.ts and the
// upload endpoint).

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface DecodedImage {
  ext: string;
  bytes: Buffer;
}

export function decodeDataUrl(dataUrl: string): DecodedImage | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = MIME_EXT[mime] ?? null;
  if (!ext) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;
  return { ext, bytes };
}
