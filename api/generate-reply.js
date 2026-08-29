import Anthropic from '@anthropic-ai/sdk';

const TONE_DESCRIPTIONS = {
  'friendly-professional': 'friendly and professional',
  'casual-warm': 'casual and warm',
  'direct-brief': 'direct and brief',
};

const MODEL = 'claude-sonnet-4-6';

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

  const { profile, thread } = req.body || {};

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

  const tone = TONE_DESCRIPTIONS[profile.tone] || 'friendly and professional';

  const systemPrompt = `You are drafting a reply on behalf of ${profile.businessName}, a business that provides: ${profile.trade}. They serve ${profile.serviceArea}.${
    profile.availability ? ` Availability: ${profile.availability}.` : ''
  }

Write ONLY the message body - no preamble, no quotation marks, no signature or sign-off. Use a ${tone} tone. Draw on the business's trade, service area, and availability where it's relevant to the reply. Ask for exactly what's needed to quote or schedule the job (for example: address, photos, preferred times) - nothing more than that. Keep it concise, suitable for a text message or short email.`;

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
