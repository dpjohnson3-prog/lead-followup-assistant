import { useState } from 'react';
import {
  STAGE,
  STAGES,
  hasSequenceStarted,
  logFollowUpSent,
  pauseSequence,
  resumeSequence,
  setCadence,
  startSequence,
} from '../lib/leads';
import FollowUpSequence from './FollowUpSequence';

export default function LeadThread({ profile, lead, onUpdateLead, onBack }) {
  const [replyText, setReplyText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!lead) {
    return (
      <section className="lead-thread lead-thread--empty">
        <p>Select a lead or create a new one to get started.</p>
      </section>
    );
  }

  function addMessage(sender, text) {
    onUpdateLead((prev) => ({
      ...prev,
      messages: [...prev.messages, { id: crypto.randomUUID(), sender, text, at: Date.now() }],
    }));
  }

  function handleLogReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;
    addMessage('customer', replyText.trim());
    // They answered, so stop the chase until the owner decides what's next.
    onUpdateLead(pauseSequence);
    setReplyText('');
  }

  function handleStageChange(e) {
    const stage = e.target.value;
    onUpdateLead((prev) => {
      const next = { ...prev, stage };
      // Moving a lead to Quoted is the trigger for the sequence to begin.
      if (stage === STAGE.QUOTED && !hasSequenceStarted(prev)) return startSequence(next);
      // Won or lost: nothing left to chase.
      if (stage === STAGE.BOOKED || stage === STAGE.NOT_INTERESTED) {
        return { ...next, nextFollowUpAt: null };
      }
      return next;
    });
  }

  async function handleGenerateReply() {
    setIsGenerating(true);
    setGenError('');
    try {
      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, thread: lead.messages }),
      });

      // A non-JSON body means something other than the API answered — most
      // often the reply endpoint isn't running (plain `vite dev` serves no
      // /api routes) or a proxy returned an HTML error page.
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

      onUpdateLead((prev) => ({ ...prev, draftReply: data.reply }));
    } catch (err) {
      // A failed fetch (offline, server down) throws a TypeError with an
      // unhelpful message, so give it a readable one.
      const isNetworkFailure = err instanceof TypeError;
      setGenError(
        isNetworkFailure
          ? "Couldn't reach the reply service. Check your connection and try again."
          : err.message || 'Something went wrong. Try again.',
      );
    } finally {
      // Always runs, so the button never stays stuck on "Generating…".
      setIsGenerating(false);
    }
  }

  function handleDraftChange(e) {
    const value = e.target.value;
    onUpdateLead((prev) => ({ ...prev, draftReply: value }));
  }

  async function handleCopy() {
    if (!lead.draftReply) return;
    await navigator.clipboard.writeText(lead.draftReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleMarkSent() {
    if (!lead.draftReply?.trim()) return;
    addMessage('business', lead.draftReply.trim());
    onUpdateLead((prev) => {
      const cleared = { ...prev, draftReply: '' };
      // The first reply out the door opens the sequence; every one after it is
      // a step of the chase, so it advances the counter and reschedules.
      return hasSequenceStarted(prev) ? logFollowUpSent(cleared) : startSequence(cleared);
    });
  }

  return (
    <section className="lead-thread">
      <header className="lead-thread__header">
        <div className="lead-thread__heading">
          {/* Hidden above 768px, where the lead list is always on screen. */}
          <button type="button" className="lead-thread__back" onClick={onBack}>
            <span aria-hidden="true">←</span> Leads
          </button>
          <h2>{lead.customerName || 'Unnamed lead'}</h2>
          <p className="lead-thread__meta">
            Ticket #{lead.ticketNumber} · {lead.source}
          </p>
        </div>
        <label className="stage-select">
          <span className="visually-hidden">Pipeline stage</span>
          <select
            className={`stage-select__control stage-select__control--${lead.stage}`}
            value={lead.stage}
            onChange={handleStageChange}
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="lead-thread__messages">
        {lead.messages.map((m) => (
          <div key={m.id} className={`message message--${m.sender}`}>
            <p>{m.text}</p>
          </div>
        ))}
      </div>

      <form className="lead-thread__log-reply" onSubmit={handleLogReply}>
        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Log what the customer said back..."
        />
        <button type="submit" className="btn btn--ghost">
          Log reply
        </button>
      </form>

      <FollowUpSequence
        lead={lead}
        onStart={() => onUpdateLead(startSequence)}
        onLogSent={() => onUpdateLead(logFollowUpSent)}
        onResume={() => onUpdateLead(resumeSequence)}
        onCadenceChange={(cadence) => onUpdateLead((prev) => setCadence(prev, cadence))}
      />

      <div className="lead-thread__draft">
        <div className="lead-thread__draft-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleGenerateReply}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate reply'}
          </button>
        </div>

        {genError && (
          <p className="generate-error" role="status">
            {genError}
          </p>
        )}

        <textarea
          className="lead-thread__draft-textarea"
          value={lead.draftReply || ''}
          onChange={handleDraftChange}
          rows={5}
          placeholder="Drafted reply will appear here — edit before sending."
        />

        <div className="lead-thread__draft-footer">
          <button type="button" className="btn btn--ghost" onClick={handleCopy} disabled={!lead.draftReply}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleMarkSent}
            disabled={!lead.draftReply?.trim()}
          >
            Mark as sent
          </button>
        </div>
      </div>
    </section>
  );
}
