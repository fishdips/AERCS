import { FileText, Link2 } from 'lucide-react';
import Icon from './Icon';
import './EvidencePreview.css';

const PREVIEW_IMAGE_TYPES = ['JPG', 'JPEG', 'PNG'];

// Renders an inline preview for a piece of evidence: an iframe for PDFs, an
// <img> for images, or a placeholder icon for links / unsupported file types.
// `viewUrl` is the already-built URL for streaming the file (callers build it
// with their feature's own API helper, e.g. getEvidenceViewUrl(evidenceId)).
export default function EvidencePreview({ fileType, linkUrl, viewUrl, fileName, iconSize = 28 }) {
  if (fileType === 'PDF' && viewUrl) {
    return (
      <iframe className="evp-frame" src={viewUrl} title={fileName || 'Evidence preview'} />
    );
  }

  if (PREVIEW_IMAGE_TYPES.includes(fileType) && viewUrl) {
    return <img className="evp-img" src={viewUrl} alt={fileName || 'Evidence preview'} />;
  }

  if (fileType === 'LINK' || linkUrl) {
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
