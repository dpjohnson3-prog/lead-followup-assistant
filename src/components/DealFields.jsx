import { useState } from 'react';
import { OUTCOMES } from '../lib/leads';
import { formatMoney, parseMoney } from '../lib/money';

/**
 * Outcome, quote amount and job value. All three are optional — nothing here
 * blocks working a lead, and a blank field stays null rather than becoming 0.
 */
export default function DealFields({ lead, onChange }) {
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
    <section className="deal">
      <span className="deal__label">Deal</span>
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
    </section>
  );
}

function moneyToInput(amount) {
  return amount === null || amount === undefined ? '' : formatMoney(amount);
}
