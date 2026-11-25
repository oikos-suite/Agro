import { useState } from 'react';
import { Upload } from 'lucide-react';
import { readHistoryFile, uploadPlays } from '../../history/importHistory.js';

const MONTH = { month: 'short', year: 'numeric' };
const fmt = (n) => n.toLocaleString();
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
const monthOf = (iso) => new Date(iso).toLocaleDateString(undefined, MONTH);

/**
 * Brings listening history over from ListenBrainz or Last.fm, so stats, streaks and the year in
 * review start from years of listening rather than from the day Agro was installed.
 *
 * "Only plays before" exists for anyone who scrobbled to both services at once: plays Wanda or
 * Wander already sent here would otherwise be counted twice, since the two copies carry different
 * ids.
 */
export default function ImportHistorySection({ username, onUnauthorized }) {
  const [found, setFound] = useState(null);
  const [before, setBefore] = useState('');
  const [status, setStatus] = useState('');
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);

  const plays = found ? found.plays.filter((p) => !before || p.playedAt < before) : [];

  const fail = (err) => {
    if (err.unauthorized) onUnauthorized?.();
    else setStatus(err.message);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFound(null);
    setSent(null);
    setStatus('Reading the file…');
    try {
      const result = await readHistoryFile(file);
      if (!result.plays.length) throw new Error('No plays found in this file.');
      setFound(result);
      setStatus(result.skipped
        ? `${plural(result.skipped, 'row was not a play', 'rows were not plays')} and will be left out.`
        : '');
    } catch (err) {
      fail(err);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    setSent(0);
    setStatus('');
    try {
      const added = await uploadPlays(username, found.source, plays, setSent);
      const already = plays.length - added;
      const note = already ? ` ${plural(already, 'was', 'were')} already here.` : '';
      setStatus(`Imported ${plural(added, 'play', 'plays')}.${note}`);
      setFound(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      setSent(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Bring your history</div>
          <div className="card-subtitle">
            A ListenBrainz export (.zip) or a Last.fm CSV. The file is read in this browser, and only
            the plays are sent to your server.
          </div>
        </div>
      </div>

      {found && (
        <p className="import-summary">
          {plural(plays.length, 'play', 'plays')} from {found.source}
          {plays.length > 0 && `, ${monthOf(plays[0].playedAt)} to ${monthOf(plays[plays.length - 1].playedAt)}`}.
          {found.source === 'Last.fm' && ' Last.fm keeps no track lengths, so these count as plays, not listening time.'}
        </p>
      )}

      <div className="retention-row">
        <label className="btn btn-secondary import-pick">
          <Upload size={13} />
          <span>{found ? 'Choose another file' : 'Choose a file'}</span>
          <input type="file" accept=".zip,.jsonl,.json,.csv" onChange={handleFile} disabled={busy} hidden />
        </label>
        {found && (
          <>
            <label className="import-before">
              <span>Only plays before</span>
              <input type="date" className="form-input" value={before}
                onChange={(e) => setBefore(e.target.value)} disabled={busy} />
            </label>
            <button className="btn btn-primary" onClick={handleImport} disabled={busy || !plays.length}>
              Import {plural(plays.length, 'play', 'plays')}
            </button>
          </>
        )}
      </div>

      {sent !== null && <progress className="import-progress" max={plays.length} value={sent} />}
      <div className="empty-hint retention-notice" role="status" aria-live="polite" hidden={!status}>
        {status}
      </div>
    </div>
  );
}
