import { STATUS } from './leads';

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
 * "now" — Dave's follow-up is always in the past, so the overdue banner and
 * sidebar highlight show up whenever the demo is loaded.
 */
export function createDemoLeads() {
  const now = Date.now();

  const john = {
    id: crypto.randomUUID(),
    ticketNumber: 1003,
    customerName: 'John',
    source: 'Website',
    status: STATUS.NEW,
    followUpAt: null,
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

  const maria = {
    id: crypto.randomUUID(),
    ticketNumber: 1002,
    customerName: 'Maria',
    source: 'Facebook',
    status: STATUS.CUSTOMER_REPLIED,
    followUpAt: null,
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

  const dave = {
    id: crypto.randomUUID(),
    ticketNumber: 1001,
    customerName: 'Dave',
    source: 'Google',
    status: STATUS.FOLLOW_UP,
    // Already past, so this lead shows as due for follow-up.
    followUpAt: now - 2 * DAY,
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
        "Thanks for reaching out! Those black streaks are algae and we treat that regularly. To get you an accurate number, could you send over the property address and a photo of the roof from the street? Also let me know roughly the square footage if you have it.",
        now - 9 * DAY + 2 * HOUR,
      ),
    ],
  };

  return [john, maria, dave];
}
