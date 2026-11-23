import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard.js';
import { stubClipboard } from './test/fakeServer.js';

afterEach(() => vi.restoreAllMocks());

describe('copyText', () => {
  it('copies and says so when the clipboard accepts', async () => {
    const writeText = stubClipboard();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    expect(await copyText('secret')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('secret');
    expect(prompt).not.toHaveBeenCalled();
  });

  it('shows the text to copy by hand when the browser refuses', async () => {
    stubClipboard({ refuse: true });
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    expect(await copyText('secret', 'Copy your passphrase')).toBe(false);
    expect(prompt).toHaveBeenCalledWith('Copy your passphrase', 'secret');
  });

  it('shows the text to copy by hand where there is no clipboard at all', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    expect(await copyText('secret')).toBe(false);
    expect(prompt).toHaveBeenCalledWith('Copy this', 'secret');
  });
});
