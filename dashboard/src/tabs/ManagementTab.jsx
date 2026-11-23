import { Users, Layers } from 'lucide-react';
import SubTabs from '../expressive/SubTabs.jsx';
import { useSubPage } from '../expressive/useSubPage.js';
import PeopleTab from './PeopleTab.jsx';
import AdminPluginsTab from './AdminPluginsTab.jsx';

const PAGES = [
  { id: 'people', label: 'People', icon: Users },
  { id: 'features', label: 'Features', icon: Layers }
];

/** The administrator's page: who may use this server, and which of its features are on. */
export default function ManagementTab({ me, onUnauthorized }) {
  const [page, openPage] = useSubPage('management', PAGES.map(p => p.id));
  return (
    <>
      <SubTabs pages={PAGES} active={page} onOpen={openPage} />
      {page === 'people' && <PeopleTab me={me} onUnauthorized={onUnauthorized} />}
      {page === 'features' && <AdminPluginsTab onUnauthorized={onUnauthorized} />}
    </>
  );
}
