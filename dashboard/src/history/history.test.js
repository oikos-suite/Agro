import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { installFakeServer } from '../test/fakeServer.js';
import { BATCH_SIZE, readHistoryFile, uploadPlays } from './importHistory.js';
import { parseCsv, parseScrobbles } from './lastfm.js';
import { parseListens } from './listenbrainz.js';
import { readZipTexts } from './zip.js';

/** A ZIP archive of `files` ({ name: text }), deflated the way Python's `zipfile` writes it. */
function zipOf(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(text));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...locals, directory, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
}

const listen = (at, artist = 'Mitski', title = 'Nobody', extra = {}) => JSON.stringify({
  listened_at: at,
  recording_msid: `msid-${at}`,
  track_metadata: { artist_name: artist, track_name: title, release_name: 'Be the Cowboy', ...extra }
});

const fileOf = (name, body) => ({
  name,
  text: async () => body,
  arrayBuffer: async () => body
});

describe('ListenBrainz', () => {
  it('reads listens, times and lengths, and counts what is not a listen', () => {
    const text = [
      listen(1700000000, 'Mitski', 'Nobody', { additional_info: { duration_ms: 193_000 } }),
      '{ torn',
      JSON.stringify({ listened_at: 1700000100, track_metadata: { artist_name: 'No title' } })
    ].join('\n');
    const { plays, skipped } = parseListens(text);
    expect(skipped).toBe(2);
    expect(plays).toEqual([{
      trackTitle: 'Nobody',
      artistName: 'Mitski',
      albumName: 'Be the Cowboy',
      durationSecs: 193,
      playedAt: '2023-11-14T22:13:20.000Z',
      playUid: 'listenbrainz:msid-1700000000:1700000000'
    }]);
  });

  it('reads the listens out of an export archive and nothing else', async () => {
    const archive = zipOf({
      'user.json': '{"user_name":"k"}',
      'feedback.jsonl': listen(1),
      'listens/2023/11.jsonl': `${listen(1700000000)}\n${listen(1700000600)}\n`,
      'listens/2022/1.jsonl': listen(1641000000)
    });
    const entries = await readZipTexts(archive, (name) => name.startsWith('listens/'));
    expect(entries.map((e) => e.name)).toEqual(['listens/2023/11.jsonl', 'listens/2022/1.jsonl']);

    const { source, plays } = await readHistoryFile(fileOf('listenbrainz_k.zip', archive));
    expect(source).toBe('ListenBrainz');
    expect(plays.map((p) => p.playedAt.slice(0, 4))).toEqual(['2022', '2023', '2023']);
  });

  it('refuses an archive with no listens in it', async () => {
    const archive = zipOf({ 'user.json': '{}' });
    await expect(readHistoryFile(fileOf('other.zip', archive))).rejects.toThrow(/No listens/);
  });
});

describe('Last.fm', () => {
  it('parses quoted fields, doubled quotes and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['d', 'e', 'f']
    ]);
  });

  it('reads the headerless lastfm-to-csv layout', () => {
    const { plays, skipped } = parseScrobbles('Mitski,Be the Cowboy,Nobody,14 Nov 2023 22:13\nBroken,,,\n');
    expect(skipped).toBe(1);
    expect(plays[0]).toMatchObject({
      artistName: 'Mitski',
      albumName: 'Be the Cowboy',
      trackTitle: 'Nobody',
      durationSecs: 0,
      playedAt: '2023-11-14T22:13:00.000Z'
    });
  });

  it('reads a file with a header by column name', () => {
    const csv = 'uts,utc_time,artist,artist_mbid,album,album_mbid,track,track_mbid\n'
      + '1700000000,"14 Nov 2023, 22:13",Mitski,,,,Nobody,\n';
    const { plays } = parseScrobbles(csv);
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ albumName: null, playUid: 'lastfm:1700000000:Mitski|Nobody' });
  });
});

describe('uploading', () => {
  it('sends batches the server accepts and adds up what was new', async () => {
    const sizes = [];
    const server = installFakeServer({
      graphql: { recordScrobbles: ({ entries, device }) => { sizes.push([entries.length, device]); return entries.length - 1; } }
    });
    const plays = Array.from({ length: BATCH_SIZE + 3 }, (_, i) => ({ playUid: `p${i}` }));
    const progress = [];
    const added = await uploadPlays('k', 'Last.fm', plays, (n) => progress.push(n));
    expect(sizes).toEqual([[BATCH_SIZE, 'Last.fm'], [3, 'Last.fm']]);
    expect(progress).toEqual([BATCH_SIZE, BATCH_SIZE + 3]);
    expect(added).toBe(BATCH_SIZE + 1);
    expect(server.asked('recordScrobbles')).toBe(true);
  });
});
