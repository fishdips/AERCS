import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { renderAsync as renderDocx } from 'docx-preview';
import readExcelFile from 'read-excel-file/browser';

// Draws a fetched evidence file (as a Blob) into a DOM container. Shared by the accreditor's
// view-only viewer and the staff preview, so both render PDF / Word / Excel / images identically.
// The class names (sev-*) are styled in features/accreditor-access/SecureEvidenceViewer.css.

// The worker is a plain static file (see scripts/copy-pdf-worker.js). Importing it through webpack
// makes babel rewrite it with require() calls, which breaks it inside the browser's worker context.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js?v=${pdfjsLib.version}`;

const RENDER_WIDTH = 1100;
const MAX_SHEET_ROWS = 1000;
const MAX_SHEET_COLS = 50;

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

// Spreadsheets are drawn as plain read-only tables (textContent only, so cell contents can't inject markup).
export async function renderSpreadsheet(blob, container) {
  const sheets = await readExcelFile(blob);
  sheets.forEach(({ sheet, data }) => {
    const section = document.createElement('section');
    section.className = 'sev-sheet';

    const heading = document.createElement('h4');
    heading.textContent = sheet;
    section.appendChild(heading);

    const table = document.createElement('table');
    data.slice(0, MAX_SHEET_ROWS).forEach((row) => {
      const tr = document.createElement('tr');
      row.slice(0, MAX_SHEET_COLS).forEach((value) => {
        const td = document.createElement('td');
        td.textContent = cellText(value);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    section.appendChild(table);

    if (data.length > MAX_SHEET_ROWS) {
      const note = document.createElement('p');
      note.className = 'sev-sheet-note';
      note.textContent = `Showing the first ${MAX_SHEET_ROWS} of ${data.length} rows.`;
      section.appendChild(note);
    }
    container.appendChild(section);
  });
}

export async function renderWord(blob, container) {
  const holder = document.createElement('div');
  holder.className = 'sev-docx';
  container.appendChild(holder);
  await renderDocx(blob, holder, holder, { inWrapper: true, ignoreLastRenderedPageBreak: true });
}

export async function renderPdf(blob, container, isCancelled) {
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (isCancelled()) return;
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = (RENDER_WIDTH / base.width) * (window.devicePixelRatio > 1 ? 1.5 : 1);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'sev-canvas';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (isCancelled()) return;
      container.appendChild(canvas);
    }
  } finally {
    pdf.destroy();
  }
}

export async function renderImage(blob, container) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.className = 'sev-canvas';
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  container.appendChild(canvas);
}
