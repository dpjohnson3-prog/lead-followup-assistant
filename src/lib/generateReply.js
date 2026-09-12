import { sequenceContext } from './leads';

/**
 * Single entry point to the reply endpoint, shared by the lead thread and the
 * Due Today queue so both surface identical, already-readable errors. Throws
 * an Error whose message is safe to show the user.
 */
export async function requestDraft({ profile, lead }) {
  let res;
  try {
    res = await fetch('/api/generate-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        thread: lead.messages,
        sequence: sequenceContext(lead),
      }),
    });
  } catch (err) {
    // A failed fetch (offline, server down) throws a TypeError with an
    // unhelpful message, so give it a readable one.
    if (err instanceof TypeError) {
      throw new Error("Couldn't reach the reply service. Check your connection and try again.");
    }
    throw err;
  }

  // A non-JSON body means something other than the API answered — most often
  // the reply endpoint isn't running (plain `vite dev` serves no /api routes)
  // or a proxy returned an HTML error page.
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.error ||
        `The reply service returned an error (${res.status}). Make sure the /api route is running.`,
    );
  }

  if (!data?.reply) {
    throw new Error(
      "The reply service didn't return a draft. Make sure the /api route is running.",
    );
  }

  return data.reply;
}
