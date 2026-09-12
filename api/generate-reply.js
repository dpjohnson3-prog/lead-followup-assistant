import Anthropic from '@anthropic-ai/sdk';

const TONE_DESCRIPTIONS = {
  'friendly-professional': 'friendly and professional',
  'casual-warm': 'casual and warm',
  'direct-brief': 'direct and brief',
};

const MODEL = 'claude-sonnet-4-6';

/** Cincinnati-local user base; see src/lib/money.js. */
const CURRENCY = 'USD';

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/**
 * How hard the follow-up should push, keyed to which attempt is going out.
 * Escalation is about acknowledging the gap and lowering the cost of replying,
 * never about pressure.
 */
function escalationGuidance(attempt, daysSinceContact) {
  const gap =
    typeof daysSinceContact === 'number' && daysSinceContact > 0
      ? ` It has been about ${daysSinceContact} day${daysSinceContact === 1 ? '' : 's'} since the last contact.`
      : '';

  if (attempt <= 1) {
    return `This is the FIRST follow-up.${gap} Keep it light and short - two or three sentences. Assume the message simply got buried; do not imply they are ignoring anyone. No pressure and no deadline.`;
  }
  if (attempt === 2) {
    return `This is the SECOND follow-up.${gap} Stay warm and brief, but give one concrete reason to reply now - for example the current availability or how quickly the schedule is filling. Still no pressure.`;
  }
  return `This is follow-up number ${attempt} - the last stretch of the sequence.${gap} Acknowledge openly that it has been a while, keep it gracious, and give them an easy out: make clear that if the timing is wrong or they have gone another way, a one-line reply saying so is completely fine and you will stop following up. Do not guilt-trip and do not ask again after this.`;
}

/**
 * Builds the system prompt. Exported so the escalation tiers and the pricing
 * rule can be unit-tested without spending an API call.
 */
export function buildSystemPrompt(profile, sequence) {
  const tone = TONE_DESCRIPTIONS[profile.tone] || 'friendly and professional';
  const attempt = Number(sequence?.attempt) || 1;
  const totalSteps = Number(sequence?.totalSteps) || null;
  // Guard the empty cases explicitly: Number(null) is 0 and Number.isFinite(0)
  // is true, so a coercion-first check turns "no quote on record" into a
  // confident claim that a $0 quote was sent. A zero or negative amount is
  // treated as no quote for the same reason.
  const rawQuote = sequence?.quoteAmount;
  const numericQuote =
    rawQuote === null || rawQuote === undefined || rawQuote === ''
      ? Number.NaN
      : Number(rawQuote);
  const quoteAmount = Number.isFinite(numericQuote) && numericQuote > 0 ? numericQuote : null;

  // A follow-up is only a follow-up if a sequence is actually running; without
  // one this is still the first reply to an inbound enquiry.
  const isFollowUp = Boolean(sequence);

  const pricingRule =
    quoteAmount !== null
      ? `A quote of ${formatMoney(quoteAmount)} has already been sent to this customer. You may refer to that exact figure if it helps. Never state any other number, and never revise, discount or re-estimate it.`
      : `NO quote amount is on record for this lead. You must NOT mention any price, figure, estimate, range, deposit or discount - not even an approximate one. If pricing comes up, say the business will confirm the price once they have the details they need.`;

  return `You are drafting a message on behalf of ${profile.businessName}, a business that provides: ${profile.trade}. They serve ${profile.serviceArea}.${
    profile.availability ? ` Availability: ${profile.availability}.` : ''
  }

${
  isFollowUp
    ? `${escalationGuidance(attempt, sequence?.daysSinceContact)}${
        totalSteps ? ` This is step ${attempt} of ${totalSteps} in the planned follow-up sequence.` : ''
      }`
    : 'This is the first reply to an inbound enquiry.'
}

PRICING: ${pricingRule}

Write ONLY the message body - no preamble, no quotation marks, no subject line, no signature or sign-off. Use a ${tone} tone. Draw on the business's trade, service area, and availability where relevant. Ask for exactly what's needed to quote or schedule the job (for example: address, photos, preferred times) - nothing more than that. Do not repeat a question the customer has already answered in the conversation. Keep it concise, suitable for a text message or short email.`;
}

/**
 * Maps an error from the Anthropic SDK to an HTTP status plus a plain-English
 * message safe to show a non-technical user. `code` is machine-readable so the
 * frontend can branch later without parsing prose.
 *
 * Order matters: in the TypeScript/JS SDK, APIConnectionTimeoutError extends
 * APIConnectionError, which in turn extends APIError — so the most specific
 * classes have to be checked first.
 *
 * Each branch matches on `instanceof` OR the HTTP status, so an error that
 * arrives from a second copy of the SDK (bundler duplication defeats
 * `instanceof`) still classifies by status instead of silently falling through
 * to the catch-all.
 */
function describeError(err) {
  const status = typeof err?.status === 'number' ? err.status : null;
  // SDK errors stringify their whole JSON body into `.message`; the parsed
  // body on `.error` carries the readable sentence, so prefer that.
  const message = err?.error?.error?.message || err?.message || '';
  const isStatus = (Cls, code) => (Cls && err instanceof Cls) || status === code;

  // Billing shows up as either a 400 invalid_request_error mentioning credit,
  // or a 403 whose error type is billing_error — check both before the
  // generic status-class branches below.
  const isBillingType = err?.type === 'billing_error';
  const mentionsCredit = /credit balance|billing|purchase|too low/i.test(message);
  if (isBillingType || (isStatus(Anthropic.BadRequestError, 400) && mentionsCredit)) {
    return {
      status: 402,
      code: 'billing',
      error:
        "The Anthropic account is out of credit. Add credit in the Anthropic Console, then try again.",
    };
  }

  if (isStatus(Anthropic.AuthenticationError, 401)) {
    return {
      status: 500,
      code: 'invalid_api_key',
      error:
        'The server\'s Anthropic API key was rejected. Check that ANTHROPIC_API_KEY is set to a valid key.',
    };
  }

  if (isStatus(Anthropic.PermissionDeniedError, 403)) {
    return {
      status: 500,
      code: 'permission_denied',
      error:
        "The Anthropic API key doesn't have access to this model. Check the key's permissions in the Anthropic Console.",
    };
  }

  // A 404 from this endpoint means the model ID doesn't exist or the key can't
  // see it — not a missing URL. Name the model so the fix is obvious.
  if (isStatus(Anthropic.NotFoundError, 404)) {
    return {
      status: 500,
      code: 'unknown_model',
      error: `Anthropic doesn't recognize the model "${MODEL}". Check the model ID in api/generate-reply.js.`,
    };
  }

  if (isStatus(Anthropic.RateLimitError, 429)) {
    return {
      status: 429,
      code: 'rate_limit',
      error: 'Too many requests right now. Wait a few seconds and try again.',
    };
  }

  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      status: 504,
      code: 'timeout',
      error: 'The request to Anthropic timed out. Try again.',
    };
  }

  // Covers DNS failures, refused connections, and dropped sockets. These carry
  // no HTTP status, so there is no status fallback to pair with.
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      status: 503,
      code: 'network',
      error: "Couldn't reach Anthropic. Check the server's network connection and try again.",
    };
  }

  if (isStatus(Anthropic.InternalServerError, 500) || (status !== null && status >= 500)) {
    return {
      status: 503,
      code: 'upstream_unavailable',
      error: 'Anthropic is temporarily unavailable. Try again in a moment.',
    };
  }

  // Surface Anthropic's own message here: a 400 is a bug in the request we
  // built (bad parameter, malformed messages), and the API says exactly what
  // is wrong. Guessing "shorten the thread" hid that.
  if (isStatus(Anthropic.BadRequestError, 400)) {
    return {
      status: 400,
      code: 'bad_request',
      error: `Anthropic rejected the request: ${message || 'no detail provided'}`,
    };
  }

  if (err instanceof Anthropic.APIError || status !== null) {
    return {
      status: 502,
      code: 'api_error',
      error: `Anthropic returned an unexpected error${status ? ` (${status})` : ''}: ${
        message || 'no detail provided'
      }`,
    };
  }

  // Nothing above matched, so this is not an API response at all — most often
  // a bug in this function or a client that failed to construct. Report what
  // was actually thrown; a bare "something went wrong" makes this undebuggable
  // without server logs.
  return {
    status: 500,
    code: 'unknown',
    error: `Reply generation failed: ${err?.name || 'Error'}${
      message ? ` — ${message}` : ' (no message)'
    }`,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
  }

  const { profile, thread, sequence } = req.body || {};

  if (!profile?.businessName || !Array.isArray(thread) || thread.length === 0) {
    return res.status(400).json({
      error: 'A business profile and at least one message are required.',
      code: 'invalid_payload',
    });
  }

  // Caught up front so a missing key gives a clear setup message rather than
  // an opaque failure from the SDK constructor.
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error:
        'The server is missing its ANTHROPIC_API_KEY. Add it to your environment variables and redeploy.',
      code: 'missing_api_key',
    });
  }

  const systemPrompt = buildSystemPrompt(profile, sequence);

  const conversationText = thread
    .map((m) => `${m.sender === 'customer' ? 'Customer' : 'Business'}: ${m.text}`)
    .join('\n');

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation so far:\n\n${conversationText}\n\nDraft the next reply from the business.`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');

    if (!textBlock) {
      return res.status(502).json({
        error: 'Anthropic returned an empty reply. Try again.',
        code: 'empty_response',
      });
    }

    return res.status(200).json({ reply: textBlock.text.trim() });
  } catch (err) {
    const { status, code, error } = describeError(err);
    // Full detail stays in the server log; the client only sees the plain message.
    console.error(`generate-reply failed [${code}]`, err);
    return res.status(status).json({ error, code });
  }
}
