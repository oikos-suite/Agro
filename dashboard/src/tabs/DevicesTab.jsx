import { useCallback, useEffect, useState } from 'react';
import { gql } from '../api.js';
import Section from '../expressive/Section.jsx';
import { useSectionLink } from '../expressive/useSectionLink.js';
import DeviceGrid from './devices/DeviceGrid.jsx';
import SignIns from './devices/SignIns.jsx';
import BackupsTab from './BackupsTab.jsx';

const APP_PASSWORDS_QUERY = `query Devices($user: String!) {
  appPasswords(userId: $user) { id label createdAt lastUsedAt }
}`;

const MINT_MUTATION = `mutation MintToken($user: String!, $label: String!) {
  createAppPassword(userId: $user, label: $label) { token label }
}`;

const REVOKE_MUTATION = `mutation Revoke($user: String!, $id: Int!) {
  revokeAppPassword(userId: $user, id: $id)
}`;

const RENAME_NODE = `mutation RenameNode($user: String!, $device: String!, $name: String!) {
  renameNode(userId: $user, deviceId: $device, petname: $name)
}`;

const REMOVE_NODE = `mutation RemoveNode($user: String!, $device: String!) {
  unregisterNode(userId: $user, deviceId: $device)
}`;

/**
 * Everything that belongs to the account's devices, on one page: the players themselves, the
 * credentials they sign in with, and the backups they send. Each part is small, so they are shown
 * one under another rather than behind tabs. `#/devices/keys`, `#/devices/backups` and the old
 * `#/backups` scroll to their part.
 */
export default function DevicesTab({ username, nodes = [], onChanged, onUnauthorized }) {
  useSectionLink('devices', { backups: 'backups' });
  const [appPasswords, setAppPasswords] = useState([]);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await gql(APP_PASSWORDS_QUERY, { user: username });
      const body = await res.json();
      setAppPasswords(body?.data?.appPasswords ?? []);
    } catch (err) {
      if (err.unauthorized) onUnauthorized?.();
    }
  }, [username, onUnauthorized]);

  useEffect(() => { void load(); }, [load]);

  async function pair(label) {
    try {
      const res = await gql(MINT_MUTATION, { user: username, label });
      const body = await res.json();
      if (body?.errors?.length) throw new Error(body.errors[0].message);
      void load();
      return body?.data?.createAppPassword ?? null;
    } catch (e) {
      if (e.unauthorized) onUnauthorized?.();
      else alert(e.message);
      return null;
    }
  }

  /**
   * Runs one change to a player and says if the server refused it. The list is not edited here:
   * it is re-read, so it shows what the server actually holds rather than what was asked for.
   */
  async function changePlayer(query, variables, done) {
    setNotice('');
    try {
      const res = await gql(query, { user: username, ...variables });
      const body = await res.json();
      if (body?.errors?.length) throw new Error(body.errors[0].message);
      // Both mutations answer `false` when no such device was found.
      if (Object.values(body?.data ?? {})[0] !== true) throw new Error('That device is no longer on this account.');
      setNotice(done);
      onChanged?.();
    } catch (err) {
      if (err.unauthorized) onUnauthorized?.();
      else setNotice(err.message);
    }
  }

  async function renamePlayer(node) {
    const typed = window.prompt('What should this device be called?', node.petname);
    const name = typed?.trim();
    if (!name || name === node.petname) return;
    await changePlayer(RENAME_NODE, { device: node.deviceId, name }, `Renamed to “${name}”.`);
  }

  async function removePlayer(node) {
    const ask = `Remove “${node.petname}” from this list?\n\nIts sign-in stays valid, so it can reconnect. Revoke it under Sign-ins to stop that.`;
    if (!window.confirm(ask)) return;
    await changePlayer(REMOVE_NODE, { device: node.deviceId }, `Removed “${node.petname}”.`);
  }

  async function revoke(device) {
    if (!window.confirm(`Revoke “${device.label}”?\n\nThat device will be signed out immediately.`)) return;
    setBusy(device.id);
    setNotice('');
    try {
      const res = await gql(REVOKE_MUTATION, { user: username, id: device.id });
      const body = await res.json();
      if (body?.errors?.length) throw new Error(body.errors[0].message);
      setNotice(`Revoked “${device.label}”.`);
      await load();
    } catch (err) {
      if (err.unauthorized) onUnauthorized?.();
      else setNotice(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {notice && <div className="inline-notice" role="status">{notice}</div>}
      <Section id="players" title="Players">
        <DeviceGrid nodes={nodes} username={username} onRename={renamePlayer} onDelete={removePlayer} onPair={pair} />
      </Section>
      <Section id="keys" title="Sign-ins">
        <SignIns appPasswords={appPasswords} busy={busy} onRevoke={revoke} />
      </Section>
      <Section id="backups" title="Backups">
        <BackupsTab onUnauthorized={onUnauthorized} />
      </Section>
    </>
  );
}
