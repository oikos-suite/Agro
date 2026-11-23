import Section from '../expressive/Section.jsx';
import { useSectionLink } from '../expressive/useSectionLink.js';
import AccountSettingsTab from './AccountSettingsTab.jsx';
import LinksTab from './LinksTab.jsx';

/**
 * The account's own settings, and the share links it has made, on one page. Links had a tab of
 * their own, but they are set up once and seldom revisited, so they sit at the bottom here, and
 * `#/settings/links` or an old `#/links` link scrolls to them.
 */
export default function SettingsTab({ username, onUnauthorized }) {
  useSectionLink('settings', { links: 'links' });
  return (
    <>
      <AccountSettingsTab username={username} onUnauthorized={onUnauthorized} />
      <Section id="links" title="Share links">
        <LinksTab username={username} onUnauthorized={onUnauthorized} />
      </Section>
    </>
  );
}
