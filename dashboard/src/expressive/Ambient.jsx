/**
 * The backdrop behind every screen: a faint, still tint in the brand's accents under a dot grid.
 * Purely decorative, so it is hidden from assistive technology.
 */
export default function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-blob violet" />
      <div className="ambient-blob mint" />
      <div className="ambient-blob lemon" />
      <div className="ambient-grid" />
    </div>
  );
}
