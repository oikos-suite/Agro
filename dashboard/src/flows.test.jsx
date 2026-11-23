import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { installFakeServer, stubClipboard } from './test/fakeServer.js';
import AuthScreen from './AuthScreen.jsx';
import SetupScreen from './SetupScreen.jsx';
import EnrolTotpScreen from './EnrolTotpScreen.jsx';
import PeopleTab from './tabs/PeopleTab.jsx';
import AccountsPanel from './tabs/AccountsPanel.jsx';
import DevicesTab from './tabs/DevicesTab.jsx';
import DeviceGrid from './tabs/devices/DeviceGrid.jsx';
import LibraryBrowser from './tabs/LibraryBrowser.jsx';
import PlaylistDetail from './tabs/PlaylistDetail.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noop = () => {};
const type = (element, value) => fireEvent.change(element, { target: { value } });

/** The secrets shown once: copying them must either work or hand them over, never just claim to. */
describe('copying something shown only once', () => {
  it('copies the passphrase a new account gets', async () => {
    installFakeServer({
      rest: {
        '/api/v1/oidc/config': { body: { enabled: false } },
        '/api/v1/signup': { body: { username: 'newbie', passphrase: 'four-word-pass-phrase', state: 'pending' } }
      }
    });
    const writeText = stubClipboard();
    render(<AuthScreen onSignedIn={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    type(screen.getByPlaceholderText('username'), 'newbie');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy passphrase' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('four-word-pass-phrase'));
  });

  it("hands the administrator's passphrase over by hand when the browser refuses to copy", async () => {
    installFakeServer({
      rest: { '/api/v1/bootstrap': { body: { username: 'admin', passphrase: 'admin-pass-phrase' } } }
    });
    stubClipboard({ refuse: true });
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<SetupScreen initialToken="setup-token-0123456789" onSignedIn={noop} />);
    type(screen.getByLabelText('Admin username'), 'admin');
    fireEvent.submit(screen.getByLabelText('Admin username').closest('form'));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy passphrase' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledWith('Copy your passphrase', 'admin-pass-phrase'));
  });

  it('copies the recovery codes before moving on from two-factor enrolment', async () => {
    installFakeServer({
      graphql: {
        beginTotp: { otpauthUri: 'otpauth://totp/Agro:me?secret=ABC', secretBase32: 'ABC' },
        confirmTotp: { recoveryCodes: ['one-two', 'three-four'], devicesSignedOut: 0 }
      }
    });
    const writeText = stubClipboard();
    const onEnrolled = vi.fn();
    render(<EnrolTotpScreen onEnrolled={onEnrolled} />);
    type(await screen.findByPlaceholderText('123456'), '123456');
    fireEvent.click(screen.getByRole('button', { name: /Verify and enable/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Copy and continue/ }));
    await waitFor(() => expect(onEnrolled).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith('one-two\nthree-four');
  });
});

describe('invites', () => {
  it('copies a listed code, and a new one as soon as it is made', async () => {
    const server = installFakeServer({
      graphql: {
        invites: [{ code: 'INVITE-1', createdBy: 'me', createdAt: '2026-11-01T00:00:00Z', expiresAt: null, maxUses: 1, usedCount: 0, revoked: false }],
        pendingAccounts: [],
        users: [],
        createInvite: { code: 'INVITE-2' }
      }
    });
    const writeText = stubClipboard();
    render(<PeopleTab me="me" onUnauthorized={noop} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('INVITE-1'));
    fireEvent.click(screen.getByRole('button', { name: /Single use/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('INVITE-2'));
    expect(server.asked('createInvite')).toBe(true);
  });
});

describe('accounts', () => {
  it('changes a quota and deletes an account after asking', async () => {
    const server = installFakeServer({
      graphql: {
        users: [{ username: 'bob', role: 'member', state: 'active', quotaBytes: 0 }],
        setAccountQuota: { username: 'bob', quotaBytes: 104857600 },
        deleteAccount: true
      }
    });
    const prompt = vi.spyOn(window, 'prompt');
    render(<AccountsPanel me="me" onUnauthorized={noop} />);
    prompt.mockReturnValueOnce('100');
    fireEvent.click(await screen.findByRole('button', { name: 'Change quota' }));
    await waitFor(() => expect(server.asked('setAccountQuota')).toBe(true));
    prompt.mockReturnValueOnce('bob');
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    await waitFor(() => expect(server.asked('deleteAccount')).toBe(true));
  });
});

describe('pairing a device', () => {
  it('shows the new token, copies it, and re-reads the sign-ins', async () => {
    const server = installFakeServer({
      graphql: {
        appPasswords: [],
        createAppPassword: { token: 'device-token-0123456789', label: 'Laptop' }
      }
    });
    const writeText = stubClipboard();
    render(<DevicesTab username="me" nodes={[]} onUnauthorized={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Pair a device/ }));
    type(screen.getByPlaceholderText('Living room laptop'), 'Laptop');
    fireEvent.click(screen.getByRole('button', { name: 'Pair' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy token' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('device-token-0123456789'));
    expect(server.calls.filter((call) => /\bappPasswords\b/.test(call.query))).toHaveLength(2);
  });

  it('pairs by submitting the name with Enter', async () => {
    const onPair = vi.fn(async () => null);
    render(<DeviceGrid nodes={[]} username="me" onRename={noop} onDelete={noop} onPair={onPair} />);
    fireEvent.click(screen.getByRole('button', { name: /Pair a device/ }));
    const name = screen.getByPlaceholderText('Living room laptop');
    type(name, 'Phone');
    fireEvent.submit(name.closest('form'));
    await waitFor(() => expect(onPair).toHaveBeenCalledWith('Phone'));
  });
});

describe('the library', () => {
  const album = { id: 'album-1', title: 'Selected Ambient Works', subtitle: 'Aphex Twin', coverKey: null, trackCount: 13, presentOnDevice: true, sourceCount: 1 };

  it('lets the administrator remove an item from the index, after asking', async () => {
    const server = installFakeServer({
      graphql: {
        libraryBrowse: [album],
        deleteLibraryItem: true
      }
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LibraryBrowser username="admin" isAdmin devices={[]} onUnauthorized={noop} />);
    fireEvent.click(await screen.findByTitle('Remove from Server'));
    await waitFor(() => expect(server.asked('deleteLibraryItem')).toBe(true));
  });

  it('offers removal only to the administrator, whatever the account is called', async () => {
    installFakeServer({ graphql: { libraryBrowse: [album] } });
    render(<LibraryBrowser username="alpha" devices={[]} onUnauthorized={noop} />);
    await screen.findByText('Selected Ambient Works');
    expect(screen.queryByTitle('Remove from Server')).toBeNull();
  });
});

describe('a playlist', () => {
  const item = (id, title) => ({ id, title, artist: 'Artist', album: null, durationMs: 1000, artworkUrl: null, coverKey: null, addedBy: 'me', addedAt: '2026-11-01T00:00:00Z' });
  const playlist = {
    id: 'p1', userId: 'me', title: 'Mix', description: '', visibility: 'FRIENDS', editAccess: 'OFF', myRole: 'OWNER',
    isFollowing: false, revision: 1, itemCount: 2, totalDurationMs: 2000, updatedAt: '2026-11-01T00:00:00Z',
    items: [item('i1', 'First'), item('i2', 'Second')]
  };

  it('moves a track and copies the link', async () => {
    const server = installFakeServer({ graphql: { playlist, applyPlaylistEdits: { ...playlist, revision: 2 } } });
    const writeText = stubClipboard();
    render(<PlaylistDetail id="p1" me="me" onBack={noop} onUnauthorized={noop} />);
    fireEvent.click((await screen.findAllByTitle('Move down'))[0]);
    await waitFor(() => expect(server.asked('applyPlaylistEdits')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/listen?pl=p1`));
  });
});
