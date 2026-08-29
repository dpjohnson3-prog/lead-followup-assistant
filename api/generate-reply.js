import Anthropic from '@anthropic-ai/sdk';

const TONE_DESCRIPTIONS = {
  'friendly-professional': 'friendly and professional',
  'casual-warm': 'casual and warm',
  'direct-brief': 'direct and brief',
};

/**
 * Maps an error from the Anthropic SDK to an HTTP status plus a plain-English
 * message safe to show a non-technical user. `code` is machine-readable so the
 * frontend can branch later without parsing prose.
 *
 * Order matters: in the TypeScript/JS SDK, APIConnectionTimeoutError extends
 * APIConnectionError, which in turn extends APIError — so the most specific
 * classes have to be checked first.
 */
function describeError(err) {
  // Billing shows up as either a 400 invalid_request_error mentioning credit,
  // or a 403 whose error type is billing_error — check both before the
  // generic status-class branches below.
  const isBillingType = err?.type === 'billing_error';
  const mentionsCredit = /credit balance|billing|purchase|too low/i.test(err?.message || '');
  if (isBillingType || (err instanceof Anthropic.BadRequestError && mentionsCredit)) {
    return {
      status: 402,
      code: 'billing',
      error:
        "The Anthropic account is out of credit. Add credit in the Anthropic Console, then try again.",
    };
  }

  if (err instanceof Anthropic.AuthenticationError) {
    return {
      status: 500,
      code: 'invalid_api_key',
      error:
        'The server\'s Anthropic API key was rejected. Check that ANTHROPIC_API_KEY is set to a valid key.',
    };
  }

  if (err instanceof Anthropic.PermissionDeniedError) {
    return {
      status: 500,
      code: 'permission_denied',
      error:
        "The Anthropic API key doesn't have access to this model. Check the key's permissions in the Anthropic Console.",
    };
  }

  if (err instanceof Anthropic.RateLimitError) {
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

  // Covers DNS failures, refused connections, and dropped sockets.
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      status: 503,
      code: 'network',
      error: "Couldn't reach Anthropic. Check the server's network connection and try again.",
    };
  }

  if (err instanceof Anthropic.InternalServerError) {
    return {
      status: 503,
      code: 'upstream_unavailable',
      error: 'Anthropic is temporarily unavailable. Try again in a moment.',
    };
  }

  if (err instanceof Anthropic.BadRequestError) {
    return {
      status: 400,
      code: 'bad_request',
      error: 'That conversation could not be sent to Anthropic. Try shortening the thread.',
    };
  }

  if (err instanceof Anthropic.APIError) {
    return {
      status: 502,
      code: 'api_error',
      error: 'Anthropic returned an unexpected error. Try again.',
    };
  }

  return {
    status: 500,
    code: 'unknown',
    error: 'Something went wrong generating the reply. Try again.',
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
      model: 'claude-sonnet-4-6',
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
