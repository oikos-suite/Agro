import { Trash2 } from 'lucide-react';

/** This year and the four before it, so the list never goes stale on New Year's Day. */
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i);

export default function DataRetentionSection({
  purgeYear,
  onPurgeYearChange,
  onPurgeScrobbles,
  purgeNotice
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Your history</div>
          <div className="card-subtitle">Delete listening history from this server.</div>
        </div>
      </div>

      {purgeNotice && <div className="empty-hint retention-notice">{purgeNotice}</div>}

      <div className="retention-row">
        <select
          className="form-input retention-year"
          value={purgeYear}
          onChange={(e) => onPurgeYearChange(e.target.value)}
          aria-label="Which history to delete"
        >
          <option value="">All-Time History</option>
          {YEARS.map((year) => <option key={year} value={year}>Year {year}</option>)}
        </select>

        <button className="btn btn-secondary" onClick={onPurgeScrobbles}>
          <Trash2 size={13} color="var(--status-error)" />
          <span>Delete history</span>
        </button>
      </div>
    </div>
  );
}
