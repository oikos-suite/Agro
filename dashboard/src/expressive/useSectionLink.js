import { useEffect } from 'react';

function readSection(tab, moved) {
  const [first, second] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (moved[first]) return moved[first];
  return first === tab ? second : '';
}

/**
 * Scrolls to the section named in the address, `#/<tab>/<section>`, so links to what used to be a
 * sub-tab still land on it. `moved` names old top-level tabs that are now a section here:
 * `{ backups: 'backups' }` sends an old `#/backups` link to the Backups section.
 */
export function useSectionLink(tab, moved = {}) {
  // `moved` is a constant at every call site.
  useEffect(() => {
    const follow = () => {
      const section = readSection(tab, moved);
      if (section) document.getElementById(`section-${section}`)?.scrollIntoView({ block: 'start' });
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
}
