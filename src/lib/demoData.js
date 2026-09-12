import { DEFAULT_CADENCE, STAGE } from './leads';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export const DEMO_PROFILE = {
  businessName: 'Suncoast Pressure Washing',
  trade: 'Pressure washing driveways, house exteriors, decks and roofs',
  serviceArea: 'Tallahassee and 25 miles out',
  availability: 'Booked out about a week, weekends fill up fast',
  tone: 'friendly-professional',
};

function message(sender, text, at) {
  return { id: crypto.randomUUID(), sender, text, at };
}

/**
 * Builds the sample leads fresh on each call so timestamps stay relative to
 * "now" — Dave's follow-up is always overdue, so the due banner and sidebar
 * highlight show up whenever the demo is loaded.
 */
export function createDemoLeads() {
  const now = Date.now();

  // Straight in, nothing sent yet: no sequence running.
  const john = {
    id: crypto.randomUUID(),
    ticketNumber: 1003,
    customerName: 'John',
    source: 'Website',
    stage: STAGE.NEW_LEAD,
    cadence: DEFAULT_CADENCE,
    followUpAttempt: 0,
    lastContactAt: null,
    nextFollowUpAt: null,
    sequencePaused: false,
    draftReply: '',
    createdAt: now - 2 * HOUR,
    messages: [
      message(
        'customer',
        'How much would it cost to pressure wash my driveway?',
        now - 2 * HOUR,
      ),
    ],
  };

  // Quoted, then the customer came back — the sequence pauses on their reply.
  const maria = {
    id: crypto.randomUUID(),
    ticketNumber: 1002,
    customerName: 'Maria',
    source: 'Facebook',
    stage: STAGE.QUOTED,
    cadence: DEFAULT_CADENCE,
    followUpAttempt: 0,
    lastContactAt: now - 2 * DAY + 3 * HOUR,
    nextFollowUpAt: null,
    sequencePaused: true,
    draftReply: '',
    createdAt: now - 2 * DAY,
    messages: [
      message(
        'customer',
        'Do you do house siding too? Ours has green mildew all over the north side',
        now - 2 * DAY,
      ),
      message(
        'business',
        "Hey Maria! Yes, house washing is one of our main services — that green on the north side is really common around here and it comes off well with a soft wash. Could you send a photo or two of the affected side and let me know your address? I'll get you a firm price from there.",
        now - 2 * DAY + 3 * HOUR,
      ),
      message('customer', 'Can you come out Saturday?', now - 5 * HOUR),
    ],
  };

  // Quoted nine days ago, one follow-up already sent, second one overdue.
  const dave = {
    id: crypto.randomUUID(),
    ticketNumber: 1001,
    customerName: 'Dave',
    source: 'Google',
    stage: STAGE.FOLLOW_UP,
    cadence: DEFAULT_CADENCE,
    followUpAttempt: 1,
    lastContactAt: now - 7 * DAY,
    nextFollowUpAt: now - 2 * DAY,
    sequencePaused: false,
    draftReply: '',
    createdAt: now - 9 * DAY,
    messages: [
      message(
        'customer',
        'Looking for a quote on cleaning the roof of a two story house. Lots of black streaks.',
        now - 9 * DAY,
      ),
      message(
        'business',
        'Thanks for reaching out! Those black streaks are algae and we treat that regularly. To get you an accurate number, could you send over the property address and a photo of the roof from the street? Also let me know roughly the square footage if you have it.',
        now - 9 * DAY + 2 * HOUR,
      ),
      message(
        'business',
        'Just following up on the roof cleaning quote — still happy to get you a price whenever you have those details handy.',
        now - 7 * DAY,
      ),
    ],
  };

  return [john, maria, dave];
}
