import { useState } from 'react';
import { X } from 'lucide-react';
import { gql } from '../../api.js';

const SEND_REQUEST = `mutation Send($name: String!) { sendFriendRequest(username: $name) }`;
const REDEEM_CODE = `mutation Redeem($code: String!) { redeemFriendCode(code: $code) }`;

/** Usernames are at most 32 characters (`normalise_username`); friend codes are 43. */
const USERNAME_MAX = 32;

/**
 * One field for both ways of adding someone: a username sends a request they accept, a friend
 * code from their screen makes you friends at once. The two cannot be confused, because no
 * username is as long as a code.
 */
export default function AddFriend({ onClose, onAdded, onUnauthorized }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(event) {
    event.preventDefault();
    const typed = text.trim().replace(/^@/, '');
    if (!typed) return;
    const isCode = typed.length > USERNAME_MAX;
    setBusy(true);
    setNotice('');
    try {
      const res = isCode
        ? await gql(REDEEM_CODE, { code: typed })
        : await gql(SEND_REQUEST, { name: typed.toLowerCase() });
      const body = await res.json();
      if (body?.errors?.length) throw new Error(body.errors[0].message);
      if (isCode) {
        const friend = body?.data?.redeemFriendCode;
        // The server answers null for every failure alike, on purpose: see `redeemFriendCode`.
        setNotice(friend
          ? `You and @${friend} are now friends.`
          : 'That code did not work. Codes last a few minutes and work once: ask for a fresh one.');
        if (friend) setText('');
      } else if (body?.data?.sendFriendRequest) {
        setNotice(`Request sent to @${typed.toLowerCase()}. They show up here once they accept.`);
        setText('');
      } else {
        // Also deliberately vague on the server's side, so it cannot be used to find accounts.
        setNotice('No request was sent. The name may be wrong or unlisted, or you are already connected.');
      }
      onAdded?.();
    } catch (err) {
      if (err.unauthorized) onUnauthorized?.();
      else setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card add-friend" onSubmit={submit}>
      <div className="add-friend-row">
        <input
          className="form-input add-friend-input"
          autoFocus
          placeholder="Username or friend code"
          aria-label="Username or friend code"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <p className="add-friend-hint">
        {notice || 'A friend code comes from the Add friend screen in Wanda or Wander, and lasts a few minutes.'}
      </p>
    </form>
  );
}
