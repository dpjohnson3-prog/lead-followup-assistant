import { useState } from 'react';
import {
  cadenceOf,
  draftAttemptNumber,
  logFollowUpSent,
  overdueLabel,
  stageLabel,
} from '../lib/leads';
import { requestDraft } from '../lib/generateReply';

/** Draft all is capped so one tap can never fan out into an unbounded bill. */
const DRAFT_ALL_LIMIT = 10;

/**
 * The daily queue. Everything due now or overdue, oldest first, each with its
 * follow-up drafted or one tap away from it.
 */
export default function DueToday({ profile, leads, onUpdateLead, onOpenLead, onShowAllLeads }) {
  const [errors, setErrors] = useState({});
  const [drafting, setDrafting] = useState({});
  const [bulk, setBulk] = useState(null);

  const pending = leads.filter((l) => !l.draftReply?.trim());
  const bulkTargets = pending.slice(0, DRAFT_ALL_LIMIT);

  async function draftOne(lead) {
    setDrafting((d) => ({ ...d, [lead.id]: true }));
    setErrors((e) => ({ ...e, [lead.id]: '' }));
    try {
      const reply = await requestDraft({ profile, lead });
      onUpdateLead(lead.id, (prev) => ({ ...prev, draftReply: reply }));
      return true;
    } catch (err) {
      setErrors((e) => ({ ...e, [lead.id]: err.message || 'Something went wrong. Try again.' }));
      return false;
    } finally {
      setDrafting((d) => ({ ...d, [lead.id]: false }));
    }
  }

  /**
   * Sequential rather than parallel: each draft is saved as it lands, so a
   * failure partway through keeps everything already generated, and the
   * counter reflects real progress instead of ten calls landing at once.
   */
  async function draftAll() {
    const targets = bulkTargets;
    setBulk({ done: 0, total: targets.length, failed: 0, running: true });
    let done = 0;
    let failed = 0;
    for (const lead of targets) {
      const okResult = await draftOne(lead);
      done += 1;
      if (!okResult) failed += 1;
      setBulk({ done, total: targets.length, failed, running: done < targets.length });
    }
    setBulk({ done, total: targets.length, failed, running: false });
  }

  return (
    <section className="due-today">
      <header className="due-today__header">
        <div>
          <h2>Due today</h2>
          <p className="due-today__meta">
            {leads.length} lead{leads.length === 1 ? '' : 's'} to chase
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onShowAllLeads}>
          All leads
        </button>
      </header>

      {bulkTargets.length > 0 && (
        <div className="due-today__bulk">
          <button
            type="button"
            className="btn btn--primary"
            onClick={draftAll}
            disabled={bulk?.running}
          >
            {bulk?.running
              ? `Drafting ${bulk.done + 1} of ${bulk.total}…`
              : `Draft all (${bulkTargets.length})`}
          </button>
          {bulk && !bulk.running && (
            <span className="due-today__bulk-status" role="status">
              Drafted {bulk.done - bulk.failed} of {bulk.total}
              {bulk.failed ? ` · ${bulk.failed} failed` : ''}
            </span>
          )}
          {pending.length > DRAFT_ALL_LIMIT && (
            <span className="due-today__bulk-status">
              {pending.length - DRAFT_ALL_LIMIT} more after these
            </span>
          )}
        </div>
      )}

      <ul className="due-today__list">
        {leads.map((lead) => {
          const lastMessage = lead.messages[lead.messages.length - 1];
          return (
            <li key={lead.id} className="due-card">
              <div className="due-card__top">
                <button
                  type="button"
                  className="due-card__name"
                  onClick={() => onOpenLead(lead.id)}
                >
                  {lead.customerName || 'Unnamed lead'} <span>#{lead.ticketNumber}</span>
                </button>
                <span className="due-card__overdue">{overdueLabel(lead)}</span>
              </div>

              <p className="due-card__attempt">
                {/* The counter he tracks by hand today: how far into the chase
                    this draft would be. */}
                Follow-up {draftAttemptNumber(lead)} of {cadenceOf(lead).length}
                <span className={`stage-tag stage-tag--${lead.stage}`}>{stageLabel(lead.stage)}</span>
              </p>

              {lastMessage && <p className="due-card__last">{lastMessage.text}</p>}

              {errors[lead.id] && (
                <p className="generate-error" role="status">
                  {errors[lead.id]}
                </p>
              )}

              {lead.draftReply?.trim() ? (
                <>
                  <textarea
                    className="due-card__draft"
                    value={lead.draftReply}
                    onChange={(e) =>
                      onUpdateLead(lead.id, (prev) => ({ ...prev, draftReply: e.target.value }))
                    }
                    rows={4}
                  />
                  <div className="due-card__actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => navigator.clipboard.writeText(lead.draftReply)}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() =>
                        onUpdateLead(lead.id, (prev) =>
                          logFollowUpSent({
                            ...prev,
                            draftReply: '',
                            messages: [
                              ...prev.messages,
                              {
                                id: crypto.randomUUID(),
                                sender: 'business',
                                text: prev.draftReply.trim(),
                                at: Date.now(),
                              },
                            ],
                          }),
                        )
                      }
                    >
                      Mark as sent
                    </button>
                  </div>
                </>
              ) : (
                <div className="due-card__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => draftOne(lead)}
                    disabled={drafting[lead.id]}
                  >
                    {drafting[lead.id] ? 'Drafting…' : 'Draft follow-up'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
