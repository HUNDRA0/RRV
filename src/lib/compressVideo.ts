// Client-side video re-encode using the browser's MediaRecorder API.
//
// Why: Vercel caps serverless function bodies at ~4.5 MB. Rather than
// rejecting larger source videos, we transcode them down to a target size
// right in the browser before upload — no external deps, no server work.
//
// Strategy:
//   1. Load the source as an HTMLVideoElement to read its duration.
//   2. Compute a video bitrate from (target_bytes * 8 / duration), with a
//      floor so we never go too crusty to watch.
//   3. Pipe the element's video track + Web Audio audio track into a
//      MediaRecorder configured at that bitrate.
//   4. Play the video; recorder writes chunks until onended fires.
//   5. Result: a WebM blob the server already accepts.
//
// Caveats:
//   - Compression runs in real-time (a 60s clip takes ~60s).
//   - iOS Safari doesn't expose HTMLVideoElement.captureStream() — we
//     throw with a clear message; the caller falls back to "use YouTube".
//   - Audio is captured via Web Audio so playback is silent while we work.

export interface CompressOptions {
  targetBytes: number;        // What we aim the final size to fit under.
  onProgress?: (pct: number) => void; // 0..1 progress callback.
  minVideoBitsPerSec?: number; // Floor bitrate (default 200 kbps).
  audioBitsPerSec?: number;    // Fixed audio budget (default 96 kbps).
}

export async function compressVideoToTargetSize(
  file: File,
  opts: CompressOptions,
): Promise<Blob> {
  const target = opts.targetBytes;
  const audioBps = opts.audioBitsPerSec ?? 96_000;
  const minVideoBps = opts.minVideoBitsPerSec ?? 200_000;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.playsInline = true;
  video.muted = false;
  video.preload = 'metadata';

  // Load metadata so we know the duration.
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('kunde inte läsa videofilen'));
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error('okänd videolängd — kan inte komprimera');
  }

  // Pick a supported recorder mime. Prefer VP9, fall back to VP8/generic.
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mime = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) {
    URL.revokeObjectURL(url);
    throw new Error('din webbläsare stödjer inte videokomprimering');
  }

  // captureStream is what gives us a re-encodable video track. iOS Safari
  // lacks it on HTMLVideoElement; the caller handles that case.
  type WithCapture = HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const v = video as WithCapture;
  const cap = v.captureStream ?? v.mozCaptureStream;
  if (!cap) {
    URL.revokeObjectURL(url);
    throw new Error('din webbläsare stödjer inte komprimering');
  }
  const sourceStream = cap.call(v);
  const videoTracks = sourceStream.getVideoTracks();
  if (videoTracks.length === 0) {
    URL.revokeObjectURL(url);
    throw new Error('hittade ingen videodata att komprimera');
  }

  // Route audio through Web Audio so playback stays silent but the stream
  // still carries an audio track. Some videos have no audio — that's fine.
  const tracks: MediaStreamTrack[] = [videoTracks[0]];
  let audioCtx: AudioContext | null = null;
  let hasAudio = false;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctx();
    const source = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    // Intentionally NOT connecting source → audioCtx.destination so the
    // user doesn't hear the source playing while we re-encode it.
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) { tracks.push(audioTrack); hasAudio = true; }
  } catch {
    // No-audio video, or a browser that doesn't like createMediaElementSource
    // after the element has already started buffering. We continue silently.
  }

  const stream = new MediaStream(tracks);

  // Compute the bitrate budget. If the video has no audio, we don't need
  // to reserve any for it.
  const audioBudget = hasAudio ? audioBps : 0;
  const totalBps = (target * 8) / duration;
  const videoBps = Math.max(minVideoBps, totalBps - audioBudget);

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: Math.round(videoBps),
    audioBitsPerSecond: audioBudget,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  let progressTimer: number | null = null;

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      if (progressTimer !== null) window.clearInterval(progressTimer);
      URL.revokeObjectURL(url);
      void audioCtx?.close().catch(() => { /* best effort */ });
      const out = new Blob(chunks, { type: 'video/webm' });
      opts.onProgress?.(1);
      resolve(out);
    };
    recorder.onerror = () => {
      if (progressTimer !== null) window.clearInterval(progressTimer);
      URL.revokeObjectURL(url);
      void audioCtx?.close().catch(() => { /* best effort */ });
      reject(new Error('komprimering misslyckades'));
    };
  });

  recorder.start(500);

  try {
    await video.play();
  } catch {
    recorder.stop();
    throw new Error('kunde inte spela videon — försök igen');
  }

  // Drive a progress callback off the playback position. We clamp under
  // 1.0 so we don't briefly show "100%" before onstop actually fires.
  if (opts.onProgress) {
    progressTimer = window.setInterval(() => {
      if (video.duration > 0) {
        opts.onProgress!(Math.min(0.99, video.currentTime / video.duration));
      }
    }, 250);
  }

  await new Promise<void>((resolve) => { video.onended = () => resolve(); });
  recorder.stop();

  return finished;
}
