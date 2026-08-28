import { useState } from 'react';
import { LEAD_SOURCES } from '../lib/leads';

export default function NewLeadModal({ onCreate, onClose }) {
  const [customerName, setCustomerName] = useState('');
  const [source, setSource] = useState(LEAD_SOURCES[0]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) {
      setError('Their message is required.');
      return;
    }
    onCreate({ customerName, source, message });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New lead</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Customer name <span className="optional">(optional)</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jane Doe"
            />
          </label>

          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Their message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="What did the customer say?"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Create lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
