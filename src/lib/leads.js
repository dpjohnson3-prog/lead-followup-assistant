const DAY = 24 * 60 * 60 * 1000;

/**
 * Pipeline stages, matching the columns in the owner's tracking sheet.
 * Closed stages end the chase; everything else can carry a live sequence.
 */
export const STAGE = {
  NEW_LEAD: 'new_lead',
  QUOTED: 'quoted',
  FOLLOW_UP: 'follow_up',
  DORMANT: 'dormant',
  NOT_INTERESTED: 'not_interested',
  BOOKED: 'booked',
};

export const STAGES = [
  { value: STAGE.NEW_LEAD, label: 'New Lead' },
  { value: STAGE.QUOTED, label: 'Quoted' },
  { value: STAGE.FOLLOW_UP, label: 'Follow Up' },
  { value: STAGE.DORMANT, label: 'Dormant' },
  { value: STAGE.NOT_INTERESTED, label: 'Not Interested' },
  { value: STAGE.BOOKED, label: 'Booked' },
];

/** Won or lost: no further chasing, and excluded from the due count. */
export const CLOSED_STAGES = [STAGE.BOOKED, STAGE.NOT_INTERESTED];

/** Days after each contact. Editable per lead. */
export const DEFAULT_CADENCE = [2, 5, 12];

/** The sheet's Follow Up Attempt counter tops out around 4. */
export const MAX_CADENCE_STEPS = 4;

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

export function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function stageLabel(stage) {
  return STAGES.find((s) => s.value === stage)?.label || stage;
}

export function isClosed(lead) {
  return CLOSED_STAGES.includes(lead.stage);
}

export function cadenceOf(lead) {
  return Array.isArray(lead.cadence) && lead.cadence.length
    ? lead.cadence
    : DEFAULT_CADENCE;
}

/**
 * Whether the chase has begun. Any logged contact counts, not just a pending
 * date or a non-zero counter: a lead that was quoted and then paused by the
 * customer's reply has neither of those yet is still mid-sequence.
 */
export function hasSequenceStarted(lead) {
  return (
    Boolean(lead.lastContactAt) ||
    (lead.followUpAttempt || 0) > 0 ||
    Boolean(lead.nextFollowUpAt)
  );
}

/** How many follow-ups remain after the ones already sent. */
export function stepsRemaining(lead) {
  return Math.max(0, cadenceOf(lead).length - (lead.followUpAttempt || 0));
}

/**
 * Opens the sequence: the quote (or first reply) has just gone out, so no
 * follow-up has been sent yet and the first one is due `cadence[0]` days on.
 */
export function startSequence(lead, at = Date.now()) {
  const cadence = cadenceOf(lead);
  return {
    ...lead,
    cadence,
    followUpAttempt: 0,
    lastContactAt: at,
    nextFollowUpAt: at + cadence[0] * DAY,
    sequencePaused: false,
    stage: lead.stage === STAGE.NEW_LEAD ? STAGE.QUOTED : lead.stage,
  };
}

/**
 * Records that follow-up number N just went out and schedules N+1. Each step
 * is measured from this contact, not from the start of the sequence. When the
 * cadence runs out the lead goes Dormant rather than sitting in Follow Up with
 * nothing scheduled.
 */
export function logFollowUpSent(lead, at = Date.now()) {
  const cadence = cadenceOf(lead);
  const attempt = (lead.followUpAttempt || 0) + 1;
  const nextInterval = cadence[attempt];
  const exhausted = nextInterval === undefined;

  return {
    ...lead,
    cadence,
    followUpAttempt: attempt,
    lastContactAt: at,
    nextFollowUpAt: exhausted ? null : at + nextInterval * DAY,
    sequencePaused: false,
    stage: exhausted ? STAGE.DORMANT : STAGE.FOLLOW_UP,
  };
}

/**
 * The customer came back to us, so stop chasing. Their reply is the outcome
 * the sequence was chasing; continuing to nag after it would be worse than
 * sending nothing.
 */
export function pauseSequence(lead) {
  return { ...lead, nextFollowUpAt: null, sequencePaused: true };
}

/** Re-arms a paused sequence from the current attempt without advancing it. */
export function resumeSequence(lead, at = Date.now()) {
  const cadence = cadenceOf(lead);
  const interval = cadence[lead.followUpAttempt || 0];
  if (interval === undefined) return { ...lead, sequencePaused: false };
  return {
    ...lead,
    sequencePaused: false,
    nextFollowUpAt: at + interval * DAY,
  };
}

export function setCadence(lead, cadence, at = Date.now()) {
  const clean = cadence
    .map((n) => Math.max(1, Math.round(Number(n) || 0)))
    .slice(0, MAX_CADENCE_STEPS);
  const next = { ...lead, cadence: clean };
  // Reschedule the pending step against the new numbers so an edit takes
  // effect immediately rather than at the next contact.
  if (!next.nextFollowUpAt || next.sequencePaused || isClosed(next)) return next;
  const interval = clean[next.followUpAttempt || 0];
  if (interval === undefined) return { ...next, nextFollowUpAt: null };
  return { ...next, nextFollowUpAt: (next.lastContactAt || at) + interval * DAY };
}

export function isFollowUpDue(lead) {
  return (
    !isClosed(lead) &&
    !lead.sequencePaused &&
    Boolean(lead.nextFollowUpAt) &&
    lead.nextFollowUpAt <= Date.now()
  );
}

/** One line describing where the sequence stands, for the thread header. */
export function sequenceSummary(lead) {
  if (isClosed(lead)) return stageLabel(lead.stage);
  const total = cadenceOf(lead).length;
  const sent = lead.followUpAttempt || 0;
  if (lead.sequencePaused) return `Paused · customer replied (${sent}/${total} sent)`;
  if (!lead.nextFollowUpAt) {
    return sent >= total ? `Sequence finished · ${sent}/${total} sent` : 'No sequence yet';
  }
  const due = isFollowUpDue(lead) ? 'due now' : formatDate(lead.nextFollowUpAt);
  return `Follow-up ${sent + 1} of ${total} · ${due}`;
}

export function nextTicketNumber(leads) {
  const highest = leads.reduce(
    (max, lead) => Math.max(max, lead.ticketNumber || 0),
    1000,
  );
  return highest + 1;
}

/* ------------------------------------------------------------------ */
/* Migration                                                           */
/* ------------------------------------------------------------------ */

/** Pre-pipeline status values, kept only so stored leads can be upgraded. */
const LEGACY_STAGE_MAP = {
  new: STAGE.NEW_LEAD,
  // A sent reply in this trade is a quote going out.
  replied: STAGE.QUOTED,
  customer_replied: STAGE.FOLLOW_UP,
  follow_up: STAGE.FOLLOW_UP,
};

/**
 * Upgrades a lead saved under the old single-status model. Runs on every read,
 * so it must be idempotent: a lead already carrying a `stage` is returned as
 * is apart from filling in sequence fields it predates.
 */
export function migrateLead(lead) {
  if (!lead || typeof lead !== 'object') return lead;

  const stage =
    lead.stage || LEGACY_STAGE_MAP[lead.status] || STAGE.NEW_LEAD;

  // The old model only knew about the business's own messages, so the most
  // recent one is the best available stand-in for Last Contact Date.
  const lastBusinessMessage = [...(lead.messages || [])]
    .reverse()
    .find((m) => m.sender === 'business');

  const migrated = {
    ...lead,
    stage,
    cadence: Array.isArray(lead.cadence) && lead.cadence.length
      ? lead.cadence
      : DEFAULT_CADENCE,
    followUpAttempt: lead.followUpAttempt ?? 0,
    lastContactAt:
      lead.lastContactAt ?? lastBusinessMessage?.at ?? lead.createdAt ?? null,
    // The old single follow-up date becomes the next step of the sequence.
    nextFollowUpAt: lead.nextFollowUpAt ?? lead.followUpAt ?? null,
    sequencePaused: lead.sequencePaused ?? lead.status === 'customer_replied',
  };

  delete migrated.status;
  delete migrated.followUpAt;
  return migrated;
}

export function migrateLeads(leads) {
  return Array.isArray(leads) ? leads.map(migrateLead) : [];
}
