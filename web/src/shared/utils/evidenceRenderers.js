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

// Fills one worksheet's panel with a plain read-only table (textContent only, so cell contents
// can't inject markup).
function buildSheetTable(section, data) {
  if (!data.length) {
    const empty = document.createElement('p');
    empty.className = 'sev-sheet-note';
    empty.textContent = 'This worksheet is empty.';
    section.appendChild(empty);
    return;
  }

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
}

// Spreadsheets work like Excel: a tab bar of worksheet names, with one worksheet shown at a time
// instead of every worksheet stacked in one long list. A worksheet's table is only built the
// first time its tab is opened.
export async function renderSpreadsheet(blob, container) {
  const sheets = await readExcelFile(blob);

  const holder = document.createElement('div');
  holder.className = 'sev-sheets';
  container.appendChild(holder);

  if (sheets.length === 0) {
    const none = document.createElement('p');
    none.className = 'sev-sheet-note';
    none.textContent = 'This workbook has no worksheets.';
    holder.appendChild(none);
    return;
  }

  const tabList = document.createElement('div');
  tabList.className = 'sev-sheet-tabs';
  tabList.setAttribute('role', 'tablist');
  holder.appendChild(tabList);

  const tabs = [];
  const panels = [];

  const activate = (index) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('sev-sheet-tab-active', active);
      panels[i].hidden = !active;
    });
    const panel = panels[index];
    if (!panel.dataset.built) {
      buildSheetTable(panel, sheets[index].data);
      panel.dataset.built = 'true';
    }
  };

  sheets.forEach(({ sheet }, index) => {
    const name = sheet || `Sheet ${index + 1}`;

    // type="button" so a tab can never submit a form this preview happens to sit inside.
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'sev-sheet-tab';
    tab.setAttribute('role', 'tab');
    tab.title = name;
    tab.textContent = name;
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', (event) => {
      const last = sheets.length - 1;
      const next = {
        ArrowRight: index === last ? 0 : index + 1,
        ArrowLeft: index === 0 ? last : index - 1,
        Home: 0,
        End: last,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      activate(next);
      tabs[next].focus();
    });
    tabList.appendChild(tab);
    tabs.push(tab);

    const panel = document.createElement('section');
    panel.className = 'sev-sheet';
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = true;
    holder.appendChild(panel);
    panels.push(panel);
  });

  activate(0);
}

export async function renderWord(blob, container) {
  const holder = document.createElement('div');
  holder.className = 'sev-docx';
  container.appendChild(holder);
  await renderDocx(blob, holder, null, {
    inWrapper: true,
    ignoreWidth: true,
    ignoreHeight: true,
    ignoreLastRenderedPageBreak: true,
  });

  // Normalize fixed-width sections and positioned Word textboxes/frames so text
  // wraps cleanly inside any preview pane without clipping or overlapping.
  holder.querySelectorAll('section.docx').forEach((section) => {
    section.style.width = '100%';
    section.style.maxWidth = '100%';
    section.style.minWidth = '0';
    section.style.minHeight = 'auto';
    section.style.padding = '24px 28px';
    section.style.boxSizing = 'border-box';
  });

  holder.querySelectorAll('[style]').forEach((el) => {
    const tag = el.tagName?.toLowerCase();
    const isMedia = tag === 'img' || tag === 'canvas' || tag === 'svg';

    if (el.style.position === 'absolute' || el.style.position === 'fixed') {
      el.style.position = 'relative';
      el.style.top = 'auto';
      el.style.left = 'auto';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.margin = '0.5rem 0';
      el.style.maxWidth = '100%';
      if (!isMedia) {
        el.style.width = '100%';
        el.style.height = 'auto';
      }
    }

    if (!isMedia && el.style.height && tag !== 'tr' && tag !== 'td') {
      el.style.minHeight = el.style.height;
      el.style.height = 'auto';
    }

    if (el.style.float === 'left' || el.style.float === 'right') {
      el.style.float = 'none';
      el.style.maxWidth = '100%';
    }

    if (el.style.marginLeft && el.style.marginLeft.startsWith('-')) {
      el.style.marginLeft = '0';
    }
    if (el.style.textIndent && el.style.textIndent.startsWith('-')) {
      el.style.textIndent = '0';
    }
  });
}

// Staff preview: draws the Word file as real pages (page size, margins, headers, page breaks) and
// shrinks each page to fit the pane, the same way PDF pages are shown. Unlike renderWord above,
// nothing is reflowed or restyled, so the page looks like it does in Word.
export async function renderWordPages(blob, container) {
  const holder = document.createElement('div');
  holder.className = 'evp-docx';
  container.appendChild(holder);
  await renderDocx(blob, holder, null, {
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreLastRenderedPageBreak: false,
    breakPages: true,
  });
  fitWordPages(container);
}

// Scales every page down to the pane's width (never up). Call again when the pane is resized.
// A page's natural width is measured once, before any scaling, and remembered on the element.
export function fitWordPages(container) {
  const holder = container?.querySelector('.evp-docx');
  if (!holder) return;
  const available = holder.clientWidth;
  if (!available) return; // pane is hidden; it is fitted when it becomes visible again
  holder.querySelectorAll('section.docx').forEach((section) => {
    let natural = Number(section.dataset.pageWidth);
    if (!natural) {
      natural = section.offsetWidth;
      if (!natural) return;
      section.dataset.pageWidth = String(natural);
    }
    const scale = Math.min(1, available / natural);
    section.style.zoom = scale < 1 ? String(scale) : '';
  });
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
