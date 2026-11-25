import { gql } from '../api.js';
import { parseScrobbles } from './lastfm.js';
import { isListensEntry, parseListens } from './listenbrainz.js';
import { readZipTexts } from './zip.js';

/**
 * Listening history from another service, read in the browser and sent to Agro as ordinary plays.
 *
 * The file never leaves the browser whole: it is parsed here and only the plays go to this server,
 * through the same `recordScrobbles` mutation Wanda and Wander use. Each play carries an id derived
 * from the export, so importing the same file twice, or a later export that overlaps an earlier
 * one, adds only what is new.
 */

/** The server takes at most this many plays per request (`MAX_SCROBBLE_BATCH`). */
export const BATCH_SIZE = 500;

const RECORD = `mutation Import($userId: String!, $device: String!, $entries: [ScrobbleInput!]!) {
  recordScrobbles(userId: $userId, deviceName: $device, clientType: "import", entries: $entries)
}`;

async function readListenBrainzZip(file) {
  const entries = await readZipTexts(await file.arrayBuffer(), isListensEntry);
  if (!entries.length) throw new Error('No listens in this archive. Is it a ListenBrainz export?');
  const plays = [];
  let skipped = 0;
  for (const { text } of entries) {
    const part = parseListens(text);
    plays.push(...part.plays);
    skipped += part.skipped;
  }
  return { plays, skipped };
}

function parseBySource(source, text) {
  return source === 'Last.fm' ? parseScrobbles(text) : parseListens(text);
}

/**
 * The plays in a ListenBrainz export (`.zip`, `.jsonl`, `.json`) or a Last.fm CSV, oldest first, as
 * `{ source, plays, skipped }`. `skipped` counts rows that were not plays, so the screen can say so.
 */
export async function readHistoryFile(file) {
  const name = file.name.toLowerCase();
  let source;
  let parsed;
  if (name.endsWith('.zip')) {
    source = 'ListenBrainz';
    parsed = await readListenBrainzZip(file);
  } else if (name.endsWith('.jsonl') || name.endsWith('.json')) {
    source = 'ListenBrainz';
    parsed = parseBySource(source, await file.text());
  } else if (name.endsWith('.csv')) {
    source = 'Last.fm';
    parsed = parseBySource(source, await file.text());
  } else {
    throw new Error('Choose a ListenBrainz export (.zip or .jsonl) or a Last.fm CSV.');
  }
  parsed.plays.sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  return { source, ...parsed };
}

/**
 * Sends plays in batches, reporting `onProgress(sent)` after each. Resolves to how many were new;
 * the rest were already on the server. Stops at the first refused batch, since every batch after it
 * would be refused for the same reason.
 */
export async function uploadPlays(username, source, plays, onProgress) {
  let added = 0;
  for (let at = 0; at < plays.length; at += BATCH_SIZE) {
    const entries = plays.slice(at, at + BATCH_SIZE);
    const res = await gql(RECORD, { userId: username, device: source, entries });
    const body = await res.json();
    if (body?.errors?.length) throw new Error(body.errors[0].message);
    added += body.data.recordScrobbles;
    onProgress?.(at + entries.length);
  }
  return added;
}
