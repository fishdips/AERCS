// navigator.clipboard.writeText only works in a "secure context" (HTTPS, or
// http://localhost) — it's undefined when the app is opened over a plain-HTTP
// LAN address (e.g. http://192.168.x.x:3000), which silently no-ops instead of
// throwing. Fall back to the legacy execCommand('copy') approach in that case,
// and only report success when a copy actually happened.
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy fallback below
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const succeeded = document.execCommand('copy');
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}
