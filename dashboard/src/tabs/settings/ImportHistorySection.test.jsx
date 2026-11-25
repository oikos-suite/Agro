import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installFakeServer } from '../../test/fakeServer.js';
import ImportHistorySection from './ImportHistorySection.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const CSV = [
  'Mitski,Be the Cowboy,Nobody,14 Nov 2019 22:13',
  'Bjork,Homogenic,Joga,02 Mar 2021 08:01',
  'Broken,,,'
].join('\n');

function choose(container, name, body) {
  const input = container.querySelector('input[type=file]');
  fireEvent.change(input, { target: { files: [new File([body], name)] } });
}

describe('importing listening history', () => {
  it('reads a Last.fm export, honours the cut-off date and reports what was new', async () => {
    const sent = [];
    installFakeServer({
      graphql: { recordScrobbles: ({ entries }) => { sent.push(...entries); return entries.length; } }
    });
    const { container } = render(<ImportHistorySection username="k" />);
    choose(container, 'scrobbles.csv', CSV);

    expect(await screen.findByText(/2 plays from Last\.fm/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/1 row was not a play/);

    fireEvent.change(screen.getByLabelText('Only plays before'), { target: { value: '2020-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 play' }));

    expect(await screen.findByText('Imported 1 play.')).toBeTruthy();
    expect(sent.map((p) => p.trackTitle)).toEqual(['Nobody']);
  });

  it('says how many plays were already on the server', async () => {
    installFakeServer({ graphql: { recordScrobbles: 0 } });
    const { container } = render(<ImportHistorySection username="k" />);
    choose(container, 'scrobbles.csv', CSV);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 plays' }));
    expect(await screen.findByText('Imported 0 plays. 2 were already here.')).toBeTruthy();
  });

  it('refuses a file it cannot read', async () => {
    installFakeServer();
    const { container } = render(<ImportHistorySection username="k" />);
    choose(container, 'notes.txt', 'hello');
    expect(await screen.findByText(/Choose a ListenBrainz export/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Import/ })).toBeNull();
  });

  it('refuses a file with no plays in it', async () => {
    installFakeServer();
    const { container } = render(<ImportHistorySection username="k" />);
    choose(container, 'listens.jsonl', '{"listened_at":1}\n');
    expect(await screen.findByText('No plays found in this file.')).toBeTruthy();
  });

  it('shows the server refusing a batch', async () => {
    installFakeServer();
    globalThis.fetch.mockImplementation(async () => new Response(
      JSON.stringify({ errors: [{ message: 'at most 500 plays per request' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
    const { container } = render(<ImportHistorySection username="k" />);
    choose(container, 'listens.json', JSON.stringify([
      { listened_at: 1700000000, recording_msid: 'm', track_metadata: { artist_name: 'A', track_name: 'T' } }
    ]));
    fireEvent.click(await screen.findByRole('button', { name: 'Import 1 play' }));
    expect(await screen.findByText('at most 500 plays per request')).toBeTruthy();
  });
});
