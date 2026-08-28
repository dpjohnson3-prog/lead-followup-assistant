import Anthropic from '@anthropic-ai/sdk';

const TONE_DESCRIPTIONS = {
  'friendly-professional': 'friendly and professional',
  'casual-warm': 'casual and warm',
  'direct-brief': 'direct and brief',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile, thread } = req.body || {};

  if (!profile?.businessName || !Array.isArray(thread) || thread.length === 0) {
    return res.status(400).json({ error: 'profile and a non-empty thread are required' });
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
      return res.status(502).json({ error: 'No text in model response' });
    }

    return res.status(200).json({ reply: textBlock.text.trim() });
  } catch (err) {
    console.error('generate-reply error', err);
    return res.status(500).json({ error: 'Failed to generate reply' });
  }
}
