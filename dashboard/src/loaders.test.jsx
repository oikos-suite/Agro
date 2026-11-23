import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { installFakeServer } from './test/fakeServer.js';
import App from './App.jsx';
import SignedOut from './SignedOut.jsx';
import AccountSettingsTab from './tabs/AccountSettingsTab.jsx';
import AccountsPanel from './tabs/AccountsPanel.jsx';
import AdminPluginsTab from './tabs/AdminPluginsTab.jsx';
import BackupsTab from './tabs/BackupsTab.jsx';
import DevicesTab from './tabs/DevicesTab.jsx';
import LibraryBrowser from './tabs/LibraryBrowser.jsx';
import LibraryOverview from './tabs/LibraryOverview.jsx';
import LinksTab from './tabs/LinksTab.jsx';
import PeopleTab from './tabs/PeopleTab.jsx';
import PlaylistDetail from './tabs/PlaylistDetail.jsx';
import PopularTab from './tabs/PopularTab.jsx';
import SocialTab from './tabs/SocialTab.jsx';
import StatsTab from './tabs/StatsTab.jsx';
import YearInReview from './tabs/stats/YearInReview.jsx';

/**
 * Every page starts its own load when it mounts, and none of them waits for it: the load reports
 * its own failures. These check that each one does go out.
 */
let server;
beforeEach(() => {
  server = installFakeServer({
    graphql: { me: { username: 'me', role: 'member' } },
    rest: {
      '/api/v1/popular': { body: { tracks: [], participants: 0, days: 30 } },
      '/api/v1/setup-status': { body: { needsSetup: false } },
      '/api/v1/oidc/config': { body: { enabled: false } }
    }
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noop = () => {};
const pages = [
  ['App', () => <App />, 'me'],
  ['AccountSettingsTab', () => <AccountSettingsTab username="me" onUnauthorized={noop} />, 'syncedSettings'],
  ['AccountsPanel', () => <AccountsPanel me="me" onUnauthorized={noop} />, 'users'],
  ['AdminPluginsTab', () => <AdminPluginsTab onUnauthorized={noop} />, 'plugins'],
  ['BackupsTab', () => <BackupsTab onUnauthorized={noop} />, 'vaultBackups'],
  ['DevicesTab', () => <DevicesTab username="me" nodes={[]} onUnauthorized={noop} />, 'appPasswords'],
  ['LibraryBrowser', () => <LibraryBrowser username="me" devices={[]} onUnauthorized={noop} />, 'libraryBrowse'],
  ['LibraryOverview', () => <LibraryOverview username="me" onUnauthorized={noop} />, 'playlists'],
  ['LinksTab', () => <LinksTab username="me" onUnauthorized={noop} />, 'Links'],
  ['PeopleTab', () => <PeopleTab me="me" onUnauthorized={noop} />, 'pendingAccounts'],
  ['PlaylistDetail', () => <PlaylistDetail id="p1" me="me" onBack={noop} onUnauthorized={noop} />, 'playlist'],
  ['SocialTab', () => <SocialTab onUnauthorized={noop} />, 'friendActivity'],
  ['StatsTab', () => <StatsTab username="me" nodes={[]} onUnauthorized={noop} />, 'listeningStats'],
  ['YearInReview', () => <YearInReview username="me" year={2026} month={0} onUnauthorized={noop} />, 'agroWrapped']
];

describe('pages load on mount', () => {
  it.each(pages)('%s asks for its data', async (_, page, field) => {
    render(page());
    await waitFor(() => expect(server.asked(field)).toBe(true));
  });

  it('PopularTab asks for the chart', async () => {
    render(<PopularTab />);
    await waitFor(() => expect(server.fetched('/api/v1/popular')).toBe(true));
  });

  it('SignedOut asks whether the server needs setting up, then how to sign in', async () => {
    localStorage.clear();
    render(<SignedOut onSignedIn={noop} />);
    await waitFor(() => expect(server.fetched('/api/v1/setup-status')).toBe(true));
    await waitFor(() => expect(server.fetched('/api/v1/oidc/config')).toBe(true));
  });
});
