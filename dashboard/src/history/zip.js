/**
 * Reads the text files out of a ZIP archive, in the browser, with no library.
 *
 * Enough of the format for a ListenBrainz export, which Python's `zipfile` writes with plain
 * deflate: the end-of-central-directory record names every entry, and each entry is either stored
 * or deflated. Inflating goes through the browser's own `DecompressionStream`. ZIP64 archives and
 * other compression methods are refused with a message rather than read wrongly.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;
/** The EOCD record is 22 bytes, followed by a comment of up to 65535. */
const EOCD_SEARCH = 22 + 0xffff;

function findEndOfDirectory(view) {
  const stop = Math.max(0, view.byteLength - EOCD_SEARCH);
  for (let at = view.byteLength - 22; at >= stop; at -= 1) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) return at;
  }
  throw new Error('This file is not a ZIP archive.');
}

async function inflate(bytes) {
  const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/**
 * The entries whose name passes `wanted`, as `{ name, text }`, in archive order.
 *
 * Only the wanted entries are inflated, so a large archive costs memory for what is read, not for
 * everything in it.
 */
export async function readZipTexts(buffer, wanted) {
  const view = new DataView(buffer);
  const end = findEndOfDirectory(view);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  if (at === 0xffffffff) throw new Error('This archive is too large to read here (ZIP64).');

  const decoder = new TextDecoder();
  const out = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) throw new Error('This ZIP archive is damaged.');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, at + 46, nameLength));
    at += 46 + nameLength + extraLength + commentLength;

    if (!wanted(name)) continue;
    if (view.getUint32(local, true) !== LOCAL_SIGNATURE) throw new Error('This ZIP archive is damaged.');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const bytes = new Uint8Array(buffer, start, size);
    if (method === STORED) out.push({ name, text: decoder.decode(bytes) });
    else if (method === DEFLATED) out.push({ name, text: await inflate(bytes) });
    else throw new Error(`"${name}" uses a compression this page cannot read.`);
  }
  return out;
}
