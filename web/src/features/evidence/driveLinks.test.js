import { isGoogleDriveFolderUrl } from './driveLinks';

test.each([
  'https://drive.google.com/drive/folders/1AbCdEfGhIjK',
  'https://drive.google.com/drive/folders/1AbCdEfGhIjK?usp=sharing',
  'https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjK',
  'https://drive.google.com/drive/mobile/folders/1AbCdEfGhIjK',
  'https://drive.google.com/folderview?id=1AbCdEfGhIjK',
  'https://drive.google.com/embeddedfolderview?id=1AbCdEfGhIjK',
  'https://drive.google.com/drive/my-drive',
  'https://drive.google.com/drive/shared-with-me',
  'https://drive.google.com/drive',
  'https://drive.google.com/',
  '  https://drive.google.com/drive/folders/1AbCdEfGhIjK  ',
  'HTTPS://DRIVE.GOOGLE.COM/DRIVE/FOLDERS/1AbCdEfGhIjK',
  'https://www.drive.google.com/drive/folders/1AbCdEfGhIjK',
])('rejects the folder link %s', (link) => {
  expect(isGoogleDriveFolderUrl(link)).toBe(true);
});

test.each([
  'https://drive.google.com/file/d/1AbCdEfGhIjK/view',
  'https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing',
  'https://drive.google.com/open?id=1AbCdEfGhIjK',
  'https://docs.google.com/document/d/1AbCdEfGhIjK/edit',
  'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjK/edit#gid=0',
  'https://example.com/report.pdf',
  'https://example.com/drive/folders/1AbCdEfGhIjK',
  'https://notdrive.google.com.evil.example/drive/folders/1AbCdEfGhIjK',
])('allows the document link %s', (link) => {
  expect(isGoogleDriveFolderUrl(link)).toBe(false);
});

test('leaves empty and non-URL input to the normal URL validation', () => {
  expect(isGoogleDriveFolderUrl('')).toBe(false);
  expect(isGoogleDriveFolderUrl(undefined)).toBe(false);
  expect(isGoogleDriveFolderUrl('not a url')).toBe(false);
});
