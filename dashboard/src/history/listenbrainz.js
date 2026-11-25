/**
 * Plays from a ListenBrainz export.
 *
 * The export ZIP holds one JSON listen per line in `listens/<year>/<month>.jsonl`, each shaped like
 * `{ listened_at, recording_msid, track_metadata: { artist_name, track_name, release_name,
 * additional_info: { duration_ms } } }`. A JSON array of the same listens (the older export, and
 * what the API returns) is read too.
 *
 * The play id is ListenBrainz's own message id plus the listen time, so importing the same export
 * twice adds nothing the second time.
 */

/** Whether a ZIP entry holds listens, as opposed to feedback, pins or the profile. */
export const isListensEntry = (name) => /^listens\/.+\.jsonl$/.test(name);

function durationSecs(info = {}) {
  if (Number.isFinite(info.duration_ms)) return Math.round(info.duration_ms / 1000);
  if (Number.isFinite(info.duration)) return Math.round(info.duration);
  return 0;
}

/** One listen as a play, or `null` when it lacks an artist, a title or a time. */
export function listenToPlay(listen) {
  const meta = listen?.track_metadata;
  const at = Number(listen?.listened_at);
  const artist = meta?.artist_name?.trim();
  const title = meta?.track_name?.trim();
  if (!artist || !title || !Number.isFinite(at) || at <= 0) return null;
  const seconds = Math.floor(at);
  return {
    trackTitle: title,
    artistName: artist,
    albumName: meta.release_name?.trim() || null,
    durationSecs: durationSecs(meta.additional_info),
    playedAt: new Date(seconds * 1000).toISOString(),
    playUid: `listenbrainz:${listen.recording_msid ?? `${artist}|${title}`}:${seconds}`
  };
}

/** Every listen in a `.jsonl` or `.json` text, with a count of the lines that were not listens. */
export function parseListens(text) {
  const trimmed = text.trim();
  let listens;
  let skipped = 0;
  if (trimmed.startsWith('[')) {
    listens = JSON.parse(trimmed);
  } else {
    listens = [];
    for (const line of trimmed.split('\n')) {
      if (!line.trim()) continue;
      try {
        listens.push(JSON.parse(line));
      } catch {
        // One torn line should not cost the rest of the file; it is counted and reported.
        skipped += 1;
      }
    }
  }
  const plays = [];
  for (const listen of listens) {
    const play = listenToPlay(listen);
    if (play) plays.push(play);
    else skipped += 1;
  }
  return { plays, skipped };
}
