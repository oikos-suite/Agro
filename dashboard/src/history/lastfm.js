/**
 * Plays from a Last.fm scrobble export.
 *
 * Last.fm has no export of its own, so two community exporters cover nearly everyone:
 * - lastfm-to-csv writes `artist,album,track,date` with no header, dates like `31 Jan 2020 12:34`.
 * - The ghan.nl exporter writes a header, `uts,utc_time,artist,artist_mbid,album,...,track,...`,
 *   with `uts` in Unix seconds.
 * A file with a header is read by column name, so other exporters with `artist`, `track` and a
 * time column work as well. Times are UTC, which is what Last.fm stores.
 *
 * Last.fm keeps no play length, so these plays count towards plays and streaks but not listening
 * time. The play id is the scrobble time plus artist and title, so a second import adds nothing.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DATE_RE = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}),? (\d{1,2}):(\d{2})$/;

/** Rows of a CSV text, honouring quotes, doubled quotes and CRLF line ends. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

/** Unix seconds from `uts`, or from a `31 Jan 2020 12:34` date, or `null`. */
function toSeconds(value) {
  const text = (value ?? '').trim();
  if (/^\d{9,11}$/.test(text)) return Number(text);
  const m = DATE_RE.exec(text);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  if (month < 0) return null;
  return Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5])) / 1000;
}

function columns(header) {
  const names = header.map((cell) => cell.trim().toLowerCase());
  const find = (...options) => options.map((o) => names.indexOf(o)).find((i) => i >= 0) ?? -1;
  return {
    artist: find('artist', 'artist_name'),
    album: find('album', 'album_name'),
    track: find('track', 'track_name', 'title'),
    time: find('uts', 'timestamp', 'date', 'utc_time')
  };
}

const HEADERLESS = { artist: 0, album: 1, track: 2, time: 3 };

/** Every scrobble in a CSV text, with a count of the rows that could not be read. */
export function parseScrobbles(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { plays: [], skipped: 0 };
  const header = columns(rows[0]);
  const named = header.artist >= 0 && header.track >= 0 && header.time >= 0;
  const cols = named ? header : HEADERLESS;
  const plays = [];
  let skipped = 0;
  for (const row of named ? rows.slice(1) : rows) {
    const artist = row[cols.artist]?.trim();
    const title = row[cols.track]?.trim();
    const seconds = toSeconds(row[cols.time]);
    if (!artist || !title || !seconds) { skipped += 1; continue; }
    plays.push({
      trackTitle: title,
      artistName: artist,
      albumName: (cols.album >= 0 && row[cols.album]?.trim()) || null,
      durationSecs: 0,
      playedAt: new Date(seconds * 1000).toISOString(),
      playUid: `lastfm:${seconds}:${artist}|${title}`
    });
  }
  return { plays, skipped };
}
