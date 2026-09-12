import { useEffect, useRef, useState } from 'react';
import {
  STAGES,
  applyStageChange,
  hasSequenceStarted,
  logFollowUpSent,
  pauseSequence,
  resumeSequence,
  setCadence,
  startSequence,
} from '../lib/leads';
import { requestDraft } from '../lib/generateReply';
import FollowUpSequence from './FollowUpSequence';
import DealFields from './DealFields';

export default function LeadThread({ profile, lead, onUpdateLead, onBack }) {
  const [replyText, setReplyText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [copied, setCopied] = useState(false);

  // Open on the newest message, and follow along as messages are added. Runs
  // before the early return below so the hook order stays stable when no lead
  // is selected.
  const messagesRef = useRef(null);
  const messageCount = lead?.messages?.length ?? 0;
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  const hasDraft = Boolean(lead?.draftReply?.trim());

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
    onUpdateLead((prev) => applyStageChange(prev, stage));
  }

  async function handleGenerateReply() {
    setIsGenerating(true);
    setGenError('');
    try {
      const reply = await requestDraft({ profile, lead });
      onUpdateLead((prev) => ({ ...prev, draftReply: reply }));
    } catch (err) {
      setGenError(err.message || 'Something went wrong. Try again.');
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

      {/* Everything between the header and the pinned action row scrolls as a
          unit, so nothing can be clipped out of reach. The thread inside it
          takes the slack and keeps its own scroll. */}
      <div className="lead-thread__scroll">
        <div className="lead-thread__messages" ref={messagesRef}>
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

        <DealFields lead={lead} onChange={onUpdateLead} />

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

          {/* Small at rest so an empty box doesn't eat the thread's height;
              grows once there is something to read. */}
          <textarea
            className="lead-thread__draft-textarea"
            value={lead.draftReply || ''}
            onChange={handleDraftChange}
            rows={hasDraft ? 6 : 2}
            placeholder="Drafted reply will appear here — edit before sending."
          />
        </div>
      </div>

      {/* Outside the scroll region, so Copy and Mark as sent are on screen at
          any window height. */}
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
    </section>
  );
}
