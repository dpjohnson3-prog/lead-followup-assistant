export const STATUS = {
  NEW: 'new',
  REPLIED: 'replied',
  CUSTOMER_REPLIED: 'customer_replied',
  FOLLOW_UP: 'follow_up',
};

export const TONE_OPTIONS = [
  { value: 'friendly-professional', label: 'Friendly & professional' },
  { value: 'casual-warm', label: 'Casual & warm' },
  { value: 'direct-brief', label: 'Direct & brief' },
];

export const LEAD_SOURCES = [
  'Website',
  'Facebook',
  'Google',
  'Text',
  'Phone call',
  'Other',
];

export const FOLLOW_UP_OPTIONS = [
  { label: '1 day', days: 1 },
  { label: '2 days', days: 2 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
];

export function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function statusLabel(lead) {
  switch (lead.status) {
    case STATUS.NEW:
      return 'New lead';
    case STATUS.REPLIED:
      return 'Replied';
    case STATUS.CUSTOMER_REPLIED:
      return 'Customer replied';
    case STATUS.FOLLOW_UP:
      return `Follow-up set · ${formatDate(lead.followUpAt)}`;
    default:
      return lead.status;
  }
}

export function isFollowUpOverdue(lead) {
  return (
    lead.status === STATUS.FOLLOW_UP &&
    Boolean(lead.followUpAt) &&
    lead.followUpAt <= Date.now()
  );
}

export function nextTicketNumber(leads) {
  const highest = leads.reduce(
    (max, lead) => Math.max(max, lead.ticketNumber || 0),
    1000,
  );
  return highest + 1;
}
