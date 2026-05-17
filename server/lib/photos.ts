// Shared helpers for handling photo data-URLs (used by both seed.ts and the
// upload endpoint). Verifies that the MIME label the client provides actually
// matches the decoded bytes via magic-byte sniffing — otherwise an attacker
// could upload SVG/HTML payloads labeled as image/jpeg.

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_PHOTO_BYTES = 1_500_000; // ~1.5 MB after base64 decode

export interface DecodedImage {
  ext: string;
  bytes: Buffer;
}

// Detect the real image format from the first few bytes. Returns one of the
// supported extension strings or null if the buffer isn't a recognised image.
function sniffMagicBytes(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
  // GIF: 47 49 46 38 (37|39) 61
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
  return null;
}

export function decodeDataUrl(dataUrl: string): DecodedImage | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > 3_000_000) return null;
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const claimedExt = MIME_EXT[mime] ?? null;
  if (!claimedExt) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return null;
  // Verify the real bytes match the claimed MIME — block MIME spoofing.
  const realExt = sniffMagicBytes(bytes);
  if (!realExt) return null;
  // 'jpg' covers both image/jpeg and image/jpg labels
  if (realExt !== claimedExt) return null;
  return { ext: realExt, bytes };
}
