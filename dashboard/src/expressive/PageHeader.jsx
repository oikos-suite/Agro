/** A page's title, with room on the right for the one or two actions that belong to the whole page. */
export default function PageHeader({ title, children }) {
  return (
    <header className="page-header">
      <h1 className="page-title">{title}</h1>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  );
}
