/**
 * One titled part of a page. Pages show their parts one under another rather than behind tabs, so
 * everything a page holds is visible by scrolling. `id` lets `#/<tab>/<id>` scroll straight to it.
 */
export default function Section({ id, title, actions, children }) {
  return (
    <section id={id ? `section-${id}` : undefined} className="page-section">
      <div className="page-section-head">
        <h2 className="page-section-title">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
