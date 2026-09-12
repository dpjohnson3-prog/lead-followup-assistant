import { useState } from 'react';
import {
  MAX_CADENCE_STEPS,
  cadenceOf,
  formatDate,
  hasSequenceStarted,
  isClosed,
  isFollowUpDue,
  sequenceSummary,
} from '../lib/leads';

/**
 * The follow-up sequence panel: where the chase stands, and the controls to
 * start it, log a step, or retune the cadence for this lead.
 */
export default function FollowUpSequence({ lead, onStart, onLogSent, onResume, onCadenceChange }) {
  const [isEditing, setEditing] = useState(false);
  const [draftCadence, setDraftCadence] = useState(() => cadenceOf(lead).join(', '));
  const [error, setError] = useState('');

  const cadence = cadenceOf(lead);
  const sent = lead.followUpAttempt || 0;
  const started = hasSequenceStarted(lead);
  const closed = isClosed(lead);
  const due = isFollowUpDue(lead);
  const exhausted = sent >= cadence.length;

  function handleSaveCadence(e) {
    e.preventDefault();
    const parsed = draftCadence
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map(Number);

    if (!parsed.length || parsed.some((n) => !Number.isFinite(n) || n < 1)) {
      setError('Enter 1 to 4 day counts, e.g. 2, 5, 12');
      return;
    }
    if (parsed.length > MAX_CADENCE_STEPS) {
      setError(`At most ${MAX_CADENCE_STEPS} steps.`);
      return;
    }
    onCadenceChange(parsed);
    setError('');
    setEditing(false);
  }

  return (
    <section className={`sequence${due ? ' sequence--due' : ''}`}>
      <div className="sequence__row">
        <div className="sequence__status">
          <span className="sequence__label">Follow-up sequence</span>
          <p className="sequence__summary">{sequenceSummary(lead)}</p>
        </div>

        {!closed && (
          <div className="sequence__actions">
            {!started && (
              <button type="button" className="btn btn--ghost" onClick={onStart}>
                Start sequence
              </button>
            )}
            {started && lead.sequencePaused && (
              <button type="button" className="btn btn--ghost" onClick={onResume}>
                Resume
              </button>
            )}
            {started && !exhausted && (
              <button type="button" className="btn btn--ghost" onClick={onLogSent}>
                Log follow-up sent
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sequence__cadence">
        {isEditing ? (
          <form className="sequence__edit" onSubmit={handleSaveCadence}>
            <label>
              Days after each contact
              <input
                value={draftCadence}
                onChange={(e) => setDraftCadence(e.target.value)}
                placeholder="2, 5, 12"
                inputMode="numeric"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="sequence__edit-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setDraftCadence(cadence.join(', '));
                  setError('');
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                Save cadence
              </button>
            </div>
          </form>
        ) : (
          <>
            <span className="sequence__steps">
              Cadence: {cadence.join(', ')} days
              {lead.lastContactAt
                ? ` · last contact ${formatDate(lead.lastContactAt)}`
                : ''}
            </span>
            <button
              type="button"
              className="sequence__edit-link"
              onClick={() => {
                setDraftCadence(cadence.join(', '));
                setEditing(true);
              }}
            >
              Edit
            </button>
          </>
        )}
      </div>
    </section>
  );
}
