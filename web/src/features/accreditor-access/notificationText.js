// Wording for an accreditor's notifications. The server sends what happened (shared / expiring
// within 24 hours / within 4 hours) plus the link's current expiry; the text, including "in 3 hours",
// is worked out here at display time so it stays accurate while the page is open.

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// "3 hours 20 minutes", "45 minutes", "less than a minute"; null once the time has passed.
export function timeLeft(expiresAt, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return null;

  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return 'less than a minute';
  if (totalMinutes < 60) return plural(totalMinutes, 'minute');

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}` : plural(hours, 'hour');
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${plural(days, 'day')} ${plural(restHours, 'hour')}` : plural(days, 'day');
}

// "Just now", "5 minutes ago", "3 hours ago", "2 days ago".
export function timeAgo(value, now = Date.now()) {
  const ms = now - new Date(value).getTime();
  if (Number.isNaN(ms) || ms < 60000) return 'Just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  return `${plural(Math.floor(hours / 24), 'day')} ago`;
}

// What to show for one notification.
//   tone:    'info' | 'warning' | 'urgent' | 'expired'  (drives the colour)
//   canOpen: false once the link has expired, because it can no longer be opened
export function describeNotification(notification, now = Date.now()) {
  const { type, linkName, activityName, sharedByName, expiresAt } = notification;
  const name = `“${linkName}”`;
  const expired = new Date(expiresAt).getTime() <= now;
  const remaining = timeLeft(expiresAt, now);

  if (type === 'SHARED') {
    const who = sharedByName ? `${sharedByName} shared` : 'You were given access to';
    const about = activityName && activityName !== linkName ? ` (${activityName})` : '';
    return {
      tone: 'info',
      title: 'Evidence shared with you',
      body: `${who} ${name}${about}. ${expired ? 'This link has expired.' : `Available until ${formatDateTime(expiresAt)}.`}`,
      canOpen: !expired,
    };
  }

  if (expired) {
    return {
      tone: 'expired',
      title: 'Access expired',
      body: `Your access to ${name} expired on ${formatDateTime(expiresAt)}.`,
      canOpen: false,
    };
  }

  const urgent = type === 'EXPIRING_4H';
  return {
    tone: urgent ? 'urgent' : 'warning',
    title: urgent ? 'Access ends very soon' : 'Access ending soon',
    body: `Your access to ${name} expires in ${remaining} (${formatDateTime(expiresAt)}).`,
    canOpen: true,
  };
}
