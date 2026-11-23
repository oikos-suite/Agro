/**
 * Puts text on the clipboard or, where the browser will not, shows it in a prompt to copy by hand.
 *
 * The clipboard API exists only on a secure origin, so a dashboard reached over plain HTTP on the
 * LAN has none, and a browser may refuse permission even where it exists. Both used to fail
 * silently while the page showed a "copied" tick, which for a passphrase or recovery codes shown
 * only once meant losing them. Resolves `true` only when the text really is on the clipboard.
 */
export async function copyText(text, label = 'Copy this') {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('This browser offers no clipboard here');
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Not swallowed: the person gets the text itself, selected, to copy by hand.
    window.prompt(label, text);
    return false;
  }
}
