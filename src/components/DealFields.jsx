import { useState } from 'react';
import { OUTCOMES } from '../lib/leads';
import { formatMoney, parseMoney } from '../lib/money';

const has = (v) => v !== null && v !== undefined && v !== '';

/** True once any of the three optional fields has been filled in. */
function isRecorded(lead) {
  return has(lead.outcome) || has(lead.quoteAmount) || has(lead.jobValue);
}

/**
 * The one-line read of the deal. Shown in both states so the numbers can be
 * scanned without expanding anything.
 */
function dealSummary(lead) {
  const parts = [];
  if (has(lead.quoteAmount)) parts.push(`Quote ${formatMoney(lead.quoteAmount)}`);
  if (has(lead.jobValue)) parts.push(`Job ${formatMoney(lead.jobValue)}`);
  if (has(lead.outcome)) {
    parts.push(OUTCOMES.find((o) => o.value === lead.outcome)?.label || lead.outcome);
  }
  return parts.length ? `Deal · ${parts.join(' · ')}` : 'Deal · not recorded';
}

/**
 * Outcome, quote amount and job value. All three are optional — nothing here
 * blocks working a lead, and a blank field stays null rather than becoming 0.
 * Collapsed by default while empty, since that is most leads most of the time
 * and the row would otherwise cost the thread a chunk of height for nothing.
 */
export default function DealFields({ lead, onChange }) {
  const [isOpen, setOpen] = useState(() => isRecorded(lead));
  const [quote, setQuote] = useState(() => moneyToInput(lead.quoteAmount));
  const [value, setValue] = useState(() => moneyToInput(lead.jobValue));

  // No effect syncing these back: LeadThread is keyed by lead id, so switching
  // leads remounts this component with fresh values, and nothing outside this
  // form writes the money fields.
  function commit(field, raw, setLocal) {
    const parsed = parseMoney(raw);
    setLocal(moneyToInput(parsed));
    onChange((prev) => ({ ...prev, [field]: parsed }));
  }

  return (
    <section className={`deal${isOpen ? ' deal--open' : ''}`}>
      <button
        type="button"
        className="deal__summary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className="deal__summary-text">{dealSummary(lead)}</span>
        <span className="deal__chevron" aria-hidden="true">
          {isOpen ? '▾' : '▸'}
        </span>
      </button>

      {isOpen && (
        <div className="deal__fields">
          <label className="deal__field">
            Outcome
            <select
              value={lead.outcome || ''}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, outcome: e.target.value || null }))
              }
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deal__field">
            Quote
            <input
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              onBlur={() => commit('quoteAmount', quote, setQuote)}
              placeholder="—"
              inputMode="decimal"
            />
          </label>

          <label className="deal__field">
            Job value
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => commit('jobValue', value, setValue)}
              placeholder="—"
              inputMode="decimal"
            />
          </label>
        </div>
      )}
    </section>
  );
}

function moneyToInput(amount) {
  return amount === null || amount === undefined ? '' : formatMoney(amount);
}
