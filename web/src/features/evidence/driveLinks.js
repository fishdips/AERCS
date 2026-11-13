// Evidence links must point at a document, not at a Google Drive folder. This mirrors the
// backend rule (DriveLinkPolicy) so people get the message immediately; the backend still enforces it.
//
// Folder links are recognised by their shape, so nothing is fetched from Google:
//   /drive/folders/ID, /drive/u/0/folders/ID, /drive/mobile/folders/ID
//   /folderview?id=ID and /embeddedfolderview?id=ID
//   Drive browse pages (/drive/my-drive, /drive/shared-with-me, the Drive home page, ...)
// Links to a file (/file/d/ID/view) and to Google Docs / Sheets / Slides are fine. /open?id=ID can be
// a file or a folder and can't be told apart without asking Google, so it is allowed.

export const DRIVE_FOLDER_MESSAGE =
  "Google Drive folder links can't be added. Share a link to a specific document or file instead.";

export function isGoogleDriveFolderUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    return false; // not a URL; the normal URL validation reports that
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'drive.google.com') return false;

  const path = url.pathname.toLowerCase();
  if (path === '' || path === '/') return true; // the Drive home page is not a document
  if (path.includes('/folders/') || path.endsWith('/folders')) return true;
  if (/^\/(embedded)?folderview(\/|$)/.test(path)) return true;
  // Everything else under /drive/ is a browse view (my-drive, shared-with-me, recent, ...).
  return (path === '/drive' || path.startsWith('/drive/')) && !path.includes('/file/d/');
}
