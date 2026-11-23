import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Section from './Section.jsx';
import { useSectionLink } from './useSectionLink.js';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('Section', () => {
  it('titles its part of the page and is addressable by id', () => {
    render(<Section id="keys" title="Sign-ins" actions={<button>Add</button>}>body</Section>);
    expect(screen.getByRole('heading', { name: 'Sign-ins' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(document.getElementById('section-keys')).not.toBeNull();
  });
});

function Page({ moved }) {
  useSectionLink('devices', moved);
  return (
    <>
      <Section id="players" title="Players" />
      <Section id="backups" title="Backups" />
    </>
  );
}

describe('useSectionLink', () => {
  it('scrolls to the section named in the address', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = '#/devices/backups';
    render(<Page />);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0].id).toBe('section-backups');
  });

  it('sends an old top-level link to the section it moved into', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = '#/backups';
    render(<Page moved={{ backups: 'backups' }} />);
    expect(scroll.mock.contexts[0].id).toBe('section-backups');
  });

  it('does not scroll for a bare tab address', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = '#/devices';
    render(<Page />);
    expect(scroll).not.toHaveBeenCalled();
  });
});
