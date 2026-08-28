import { useState } from 'react';
import { statusLabel, FOLLOW_UP_OPTIONS } from '../lib/leads';

export default function LeadThread({ profile, lead, onUpdateLead }) {
  const [replyText, setReplyText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [isFollowUpOpen, setFollowUpOpen] = useState(false);
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
    onUpdateLead((prev) => ({ ...prev, status: 'customer_replied' }));
    setReplyText('');
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate reply');
      }
      const data = await res.json();
      onUpdateLead((prev) => ({ ...prev, draftReply: data.reply }));
    } catch (err) {
      setGenError(err.message || 'Something went wrong');
    } finally {
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
    onUpdateLead((prev) => ({ ...prev, draftReply: '', status: 'replied' }));
  }

  function handleSetFollowUp(days) {
    onUpdateLead((prev) => ({
      ...prev,
      status: 'follow_up',
      followUpAt: Date.now() + days * 24 * 60 * 60 * 1000,
    }));
    setFollowUpOpen(false);
  }

  return (
    <section className="lead-thread">
      <header className="lead-thread__header">
        <div>
          <h2>{lead.customerName || 'Unnamed lead'}</h2>
          <p className="lead-thread__meta">
            Ticket #{lead.ticketNumber} · {lead.source}
          </p>
        </div>
        <span className={`status-pill status-pill--${lead.status}`}>{statusLabel(lead)}</span>
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

          <div className="lead-thread__follow-up">
            <button type="button" className="btn btn--ghost" onClick={() => setFollowUpOpen((v) => !v)}>
              Follow up...
            </button>
            {isFollowUpOpen && (
              <ul className="follow-up-menu">
                {FOLLOW_UP_OPTIONS.map((opt) => (
                  <li key={opt.days}>
                    <button type="button" onClick={() => handleSetFollowUp(opt.days)}>
                      in {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {genError && <p className="form-error">{genError}</p>}

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
