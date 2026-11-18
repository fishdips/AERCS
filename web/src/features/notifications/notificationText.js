import { formatUserOffice } from '../activities/constants';

export { timeAgo } from '../accreditor-access/notificationText';

// "CCS" -> "College of Computer Studies"; an unknown "REGISTRARS_OFFICE" -> "Registrars Office".
function unitLabel(value) {
  if (!value) return '';
  const label = formatUserOffice(value);
  if (label !== value || !value.includes('_')) return label === '-' ? '' : label;
  return value.toLowerCase().split('_').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const quote = (text) => `“${text}”`;

// What to show for one staff notification. The server sends what happened plus the names as they
// were at the time; the wording is worked out here.
//   kind:    'upload' | 'version' | 'reference' | 'removed'  (picks the icon)
//   tone:    'info' | 'warning' | 'expired'                  (drives the colour)
//   path:    where clicking goes, or null when the item no longer exists
export function describeStaffNotification(notification) {
  const {
    type, actorName, actorUnit, activityId, activityName, evidenceId, evidenceName,
    versionNumber, count, activityAvailable, evidenceAvailable,
  } = notification;
  const who = actorName || 'Someone';
  const unit = unitLabel(actorUnit);
  const whoWithUnit = unit ? `${who} (${unit})` : who;
  const evidence = quote(evidenceName || 'a file');
  const activity = quote(activityName || 'an activity');
  const referencesPath = evidenceId ? `/shared-evidence/${evidenceId}/references` : null;

  let view;
  switch (type) {
    case 'EVIDENCE_UPLOADED': {
      const many = (count || 1) > 1;
      view = {
        kind: 'upload',
        tone: 'info',
        title: many ? `${count} new files uploaded` : 'New evidence uploaded',
        body: many
          ? `${who} uploaded ${count} files to ${activity}.`
          : `${who} uploaded ${evidence} to ${activity}.`,
        path: activityAvailable && activityId ? `/activities/${activityId}` : null,
        gone: !activityAvailable,
      };
      break;
    }
    case 'EVIDENCE_TAGGED': {
      const many = (count || 1) > 1;
      view = {
        kind: 'tag',
        tone: 'info',
        title: many ? `${count} files tagged for you` : 'Evidence tagged for you',
        body: many
          ? `${who} tagged ${count} files for your department or office in ${activity}.`
          : `${who} tagged ${evidence} for your department or office in ${activity}.`,
        path: evidenceAvailable ? referencesPath : null,
        gone: !evidenceAvailable,
      };
      break;
    }
    case 'EVIDENCE_NEW_VERSION':
      view = {
        kind: 'version',
        tone: 'warning',
        title: 'New version uploaded',
        body: `${who} uploaded version ${versionNumber ?? 'a new version'} of ${evidence}.`,
        path: evidenceAvailable ? referencesPath : null,
        gone: !evidenceAvailable,
      };
      break;
    case 'EVIDENCE_REFERENCED':
      view = {
        kind: 'reference',
        tone: 'info',
        title: 'Your evidence was referenced',
        body: `${whoWithUnit} referenced ${evidence} in ${activity}.`,
        path: evidenceAvailable ? referencesPath : null,
        gone: !evidenceAvailable,
      };
      break;
    case 'REFERENCE_REMOVED':
      view = {
        kind: 'removed',
        tone: 'expired',
        title: 'Reference removed',
        body: `${whoWithUnit} removed their reference to ${evidence} from ${activity}.`,
        path: evidenceAvailable ? referencesPath : null,
        gone: !evidenceAvailable,
      };
      break;
    default:
      view = { kind: 'upload', tone: 'info', title: 'Notification', body: '', path: null, gone: false };
  }

  if (view.gone) {
    view.body = `${view.body} It has since been deleted.`;
  }
  return view;
}
