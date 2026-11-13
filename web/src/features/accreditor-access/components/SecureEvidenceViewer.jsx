import { useEffect, useRef, useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { renderImage, renderPdf, renderSpreadsheet, renderWord } from '../../../shared/utils/evidenceRenderers';
import { hasMultipleVersions } from '../../evidence/constants';
import { viewAccreditorEvidenceBlob } from '../api';
import '../SecureEvidenceViewer.css';

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
        const { data } = await viewAccreditorEvidenceBlob(linkId, evidence.id, evidence.currentVersion);
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

  const modalTitle = evidence
    ? `${evidence.originalFileName || 'Evidence'}${evidence.fileType !== 'LINK' && hasMultipleVersions(evidence) ? ` (v${evidence.currentVersion})` : ''}`
    : 'Evidence';

  return (
    <Modal isOpen={Boolean(evidence)} onClose={onClose} title={modalTitle} size="wide">
      <div className="sev-root">
        {status === 'loading' && <p className="sev-status">Loading document...</p>}
        {status === 'error' && <p className="sev-status">Unable to display this evidence file.</p>}
        <div ref={pagesRef} className="sev-pages" onDragStart={(event) => event.preventDefault()} />
      </div>
    </Modal>
  );
}
