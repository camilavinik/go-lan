/**
 * Copies text, or says it could not.
 *
 * The modern clipboard API only exists on https and on localhost, and this app
 * is normally opened over plain http on a LAN address, where it is missing
 * entirely. So the old selection trick is not a fallback for old browsers here,
 * it is the path almost every invite link takes.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission refused or the page is not focused. Try the other way.
  }

  return selectAndCopy(text);
}

function selectAndCopy(text: string): boolean {
  const previous = document.activeElement;

  const carrier = document.createElement('textarea');
  carrier.value = text;
  carrier.setAttribute('readonly', '');
  carrier.setAttribute('aria-hidden', 'true');
  // Out of sight but not hidden: browsers refuse to copy from a field they
  // consider invisible, and an off screen one scrolls the page on focus.
  carrier.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;outline:none;background:transparent;';
  document.body.append(carrier);

  try {
    carrier.focus();
    carrier.select();
    carrier.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    carrier.remove();
    if (previous instanceof HTMLElement) previous.focus();
  }
}