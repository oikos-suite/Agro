import { useState } from 'react';
import { gql } from '../../api.js';
import Avatar from '../../Avatar.jsx';

const ACCEPT = `mutation Accept($name: String!) { acceptFriendRequest(username: $name) }`;
// Declining a request and cancelling one you sent are the same operation on the data.
const REMOVE = `mutation Remove($name: String!) { removeFriend(username: $name) }`;

/** Requests waiting on you first, then the ones you sent that are waiting on someone else. */
export default function FriendRequests({ requests, onChanged, onUnauthorized }) {
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  if (requests.length === 0) return null;

  const incoming = requests.filter((r) => !r.outgoing);
  const outgoing = requests.filter((r) => r.outgoing);

  async function run(query, name) {
    setBusy(name);
    setNotice('');
    try {
      const res = await gql(query, { name });
      const body = await res.json();
      if (body?.errors?.length) throw new Error(body.errors[0].message);
      if (Object.values(body?.data ?? {})[0] !== true) throw new Error(`That request from @${name} is no longer open.`);
      onChanged?.();
    } catch (err) {
      if (err.unauthorized) onUnauthorized?.();
      else setNotice(err.message);
    } finally {
      setBusy('');
    }
  }

  const row = (request, actions) => (
    <li key={request.username} className="key-row">
      <Avatar username={request.username} size={36} />
      <span className="key-text">
        <span className="key-label">{request.displayName || request.username}</span>
        <span className="key-sub">
          @{request.username} · {request.outgoing ? 'waiting for them to accept' : 'wants to be friends'}
        </span>
      </span>
      {actions}
    </li>
  );

  return (
    <div className="card">
      {notice && <div className="inline-notice" role="status">{notice}</div>}
      <ul className="key-rows">
        {incoming.map((r) => row(r, (
          <span className="friend-request-actions">
            <button className="btn btn-primary" disabled={busy === r.username} onClick={() => run(ACCEPT, r.username)}>Accept</button>
            <button className="btn btn-secondary" disabled={busy === r.username} onClick={() => run(REMOVE, r.username)}>Decline</button>
          </span>
        )))}
        {outgoing.map((r) => row(r, (
          <button className="btn btn-secondary" disabled={busy === r.username} onClick={() => run(REMOVE, r.username)}>Cancel</button>
        )))}
      </ul>
    </div>
  );
}
