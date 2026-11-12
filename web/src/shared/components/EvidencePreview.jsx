import { useEffect, useRef, useState } from 'react';
import { FileText, Link2 } from 'lucide-react';
import Icon from './Icon';
import { viewEvidenceBlob, viewEvidenceVersionBlob } from '../../features/evidence/api';
import { renderPdf, renderSpreadsheet, renderWord } from '../utils/evidenceRenderers';
// Word / Excel / PDF page styles (sev-*) are shared with the accreditor viewer.
import '../../features/accreditor-access/SecureEvidenceViewer.css';
import './EvidencePreview.css';

const IMAGE_TYPES = ['JPG', 'JPEG', 'PNG'];
const RENDERABLE_TYPES = ['PDF', 'DOCX', 'XLSX', ...IMAGE_TYPES];

// Inline preview for a piece of evidence. The file is fetched with the signed-in session and
// drawn in the page (PDF pages, Word, Excel sheets, images). It is not put in an <iframe>, because
// the API replies with headers that stop browsers from framing it. Links and unsupported
// file types get a placeholder instead.
export default function EvidencePreview({ fileType, linkUrl, evidenceId, versionId, fileName, iconSize = 28 }) {
  const isLink = fileType === 'LINK' || Boolean(linkUrl);
  const canRender = !isLink && Boolean(evidenceId) && RENDERABLE_TYPES.includes(fileType);

  const pagesRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!canRender) return undefined;

    let cancelled = false;
    let objectUrl = null;
    const container = pagesRef.current;
    setStatus('loading');

    const load = async () => {
      try {
        const { data } = versionId
          ? await viewEvidenceVersionBlob(evidenceId, versionId)
          : await viewEvidenceBlob(evidenceId);
        if (cancelled) return;
        if (fileType === 'PDF') {
          await renderPdf(data, container, () => cancelled);
        } else if (fileType === 'DOCX') {
          await renderWord(data, container);
        } else if (fileType === 'XLSX') {
          await renderSpreadsheet(data, container);
        } else {
          objectUrl = URL.createObjectURL(data);
          const img = document.createElement('img');
          img.className = 'evp-img';
          img.alt = fileName || 'Evidence preview';
          img.src = objectUrl;
          container.appendChild(img);
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
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canRender, evidenceId, versionId, fileType, fileName]);

  if (canRender) {
    return (
      <div className="evp-rendered">
        <div className="evp-pages" ref={pagesRef} />
        {status === 'loading' && <p className="evp-status">Loading preview...</p>}
        {status === 'error' && <p className="evp-status">Preview unavailable. Use Download to open the file.</p>}
      </div>
    );
  }

  if (isLink) {
    return (
      <div className="evp-placeholder">
        <Icon as={Link2} size={iconSize} />
        <p>External link &mdash; use Open Link to view</p>
      </div>
    );
  }

  return (
    <div className="evp-placeholder">
      <Icon as={FileText} size={iconSize} />
      <p>No preview available for this file type</p>
    </div>
  );
}
