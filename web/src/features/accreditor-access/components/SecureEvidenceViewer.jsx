import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { renderAsync as renderDocx } from 'docx-preview';
import readExcelFile from 'read-excel-file/browser';
import Modal from '../../../shared/components/Modal';
import { viewAccreditorEvidenceBlob } from '../api';
import '../SecureEvidenceViewer.css';

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
async function renderSpreadsheet(blob, container) {
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

async function renderWord(blob, container) {
  const holder = document.createElement('div');
  holder.className = 'sev-docx';
  container.appendChild(holder);
  await renderDocx(blob, holder, holder, { inWrapper: true, ignoreLastRenderedPageBreak: true });
}

async function renderPdf(blob, container, isCancelled) {
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

async function renderImage(blob, container) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.className = 'sev-canvas';
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  container.appendChild(canvas);
}

export default function SecureEvidenceViewer({ linkId, evidence, onClose }) {
  const pagesRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!evidence) return undefined;

    let cancelled = false;
    const container = pagesRef.current;
    setStatus('loading');

    const load = async () => {
      try {
        const { data } = await viewAccreditorEvidenceBlob(linkId, evidence.id);
        if (cancelled) return;
        if (evidence.fileType === 'PDF') {
          await renderPdf(data, container, () => cancelled);
        } else if (evidence.fileType === 'DOCX') {
          await renderWord(data, container);
        } else if (evidence.fileType === 'XLSX') {
          await renderSpreadsheet(data, container);
        } else {
          await renderImage(data, container);
        }
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    load();

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [linkId, evidence]);

  // View-only: block the save / print / copy shortcuts and the context menu while open.
  useEffect(() => {
    if (!evidence) return undefined;
    const blockKeys = (event) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['s', 'p', 'c', 'u'].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const blockMenu = (event) => event.preventDefault();
    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('contextmenu', blockMenu, true);
    return () => {
      document.removeEventListener('keydown', blockKeys, true);
      document.removeEventListener('contextmenu', blockMenu, true);
    };
  }, [evidence]);

  return (
    <Modal isOpen={Boolean(evidence)} onClose={onClose} title={evidence?.originalFileName || 'Evidence'} size="wide">
      <div className="sev-root">
        <p className="sev-notice">
          View only.
        </p>
        {status === 'loading' && <p className="sev-status">Loading document...</p>}
        {status === 'error' && <p className="sev-status">Unable to display this evidence file.</p>}
        <div ref={pagesRef} className="sev-pages" onDragStart={(event) => event.preventDefault()} />
      </div>
    </Modal>
  );
}
