import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock, Flame, Mic2, Music2, Radio, Sparkles } from 'lucide-react';
import { gql } from '../../api.js';
import Cookie from '../../expressive/Cookie.jsx';
import StatsTopLists from './StatsTopLists.jsx';
import { DeviceSplit } from './StatsSummary.jsx';
import { MONTHS, splitTitle } from './format.js';

const WRAPPED_QUERY = `query Wrapped($user: String!, $year: Int!, $month: Int, $offset: Int) {
  agroWrapped(userId: $user, year: $year, month: $month, utcOffsetMinutes: $offset) {
    totalMinutes totalPlays totalArtists newArtistsCount activeDaysCount longestStreakDays
    topHourLocal byMonth byHour
    topArtists { name value } topTracks { name value } topAlbums { name value }
    topGenres { name value } byDevice { name value }
  }
}`;

/**
 * A year, or one month of it, in review: the same recap Wanda shows as Replay, from the same query.
 * Bucketed on this browser's clock, so "most often around 9pm" means the listener's 9pm.
 */
export default function YearInReview({ username, year, month, onUnauthorized }) {
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await gql(WRAPPED_QUERY, {
        user: username,
        year,
        month: month || null,
        offset: -new Date().getTimezoneOffset()
      });
      const body = await res.json();
      const failure = body?.errors?.[0];
      if (failure) {
        setRecap(null);
        setError(failure.extensions?.code === 'FEATURE_DISABLED'
          ? 'Year in review is switched off on this server.'
          : failure.message);
        return;
      }
      setRecap(body?.data?.agroWrapped ?? null);
    } catch (err) {
      if (err.unauthorized) onUnauthorized?.();
      else setError(err.message);
    }
  }, [username, year, month, onUnauthorized]);

  useEffect(() => { if (username) void load(); }, [username, load]);

  const span = month ? `${MONTHS[month - 1]} ${year}` : String(year);
  if (error) return <div className="empty-hint" role="alert">{error}</div>;
  if (!recap) return <div className="empty-hint">Loading…</div>;
  if (recap.totalPlays === 0) return <div className="empty-hint">Nothing was played in {span}.</div>;

  const top = recap.topTracks[0] ? splitTitle(recap.topTracks[0].name) : null;
  const hour = recap.topHourLocal;

  return (
    <>
      <div className="card stats-hero">
        <div className="stats-big">
          <span className="stats-big-number">{recap.totalMinutes.toLocaleString()}</span>
          <span className="stats-big-label">minutes listened in {span}</span>
        </div>

        {top && (
          <div className="stats-top-song">
            <Cookie shape="flower" size={64}><Music2 size={26} /></Cookie>
            <div className="stats-top-song-text">
              <span className="stats-overline">Song of the {month ? 'month' : 'year'}</span>
              <span className="stats-top-title">{top.title}</span>
              {top.artist && <span className="stats-top-artist">{top.artist}</span>}
            </div>
            <span className="stats-top-count">×{recap.topTracks[0].value}</span>
          </div>
        )}

        <div className="stats-facts">
          <span className="stats-fact"><Music2 size={15} />{recap.totalPlays.toLocaleString()} plays</span>
          <span className="stats-fact"><Mic2 size={15} />{recap.totalArtists} artists, {recap.newArtistsCount} new</span>
          <span className="stats-fact"><CalendarDays size={15} />{recap.activeDaysCount} days with music</span>
          <span className="stats-fact"><Flame size={15} />{recap.longestStreakDays} day streak</span>
          {hour !== null && <span className="stats-fact"><Clock size={15} />Most often around {String(hour).padStart(2, '0')}:00</span>}
          {recap.topGenres[0] && <span className="stats-fact"><Radio size={15} />Mostly {recap.topGenres[0].name}</span>}
        </div>

        {recap.byDevice.length > 0 && <DeviceSplit devices={recap.byDevice} format={(plays) => `${plays} plays`} />}
      </div>

      <div className={month ? '' : 'stats-charts'}>
        {!month && (
          <div className="card">
            <div className="card-title"><Sparkles size={18} />Month by month</div>
            <Bars values={recap.byMonth} label={(i) => MONTHS[i]} axis={['Jan', 'Apr', 'Jul', 'Oct', 'Dec']} />
          </div>
        )}
        <div className="card">
          <div className="card-title"><Clock size={18} />Through the day</div>
          <Bars values={recap.byHour} label={(i) => `${String(i).padStart(2, '0')}:00`} axis={['00', '06', '12', '18', '23']} />
        </div>
      </div>

      <StatsTopLists stats={recap} />
    </>
  );
}

/** Plays per bucket, scaled to the busiest, which is picked out. */
function Bars({ values, label, axis }) {
  const peak = Math.max(1, ...values);
  const busiest = values.indexOf(Math.max(...values));
  return (
    <div className="hour-chart">
      <div className="hour-bars">
        {values.map((value, index) => (
          <span
            key={index}
            className={`hour-bar ${index === busiest && value > 0 ? 'is-peak' : ''}`}
            style={{ height: `${Math.max(4, (value / peak) * 100)}%` }}
            title={`${label(index)} · ${value} ${value === 1 ? 'play' : 'plays'}`}
          />
        ))}
      </div>
      <div className="hour-axis">{axis.map((tick) => <span key={tick}>{tick}</span>)}</div>
    </div>
  );
}
