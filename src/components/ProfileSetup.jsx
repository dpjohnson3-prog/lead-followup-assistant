import { useState } from 'react';
import { TONE_OPTIONS } from '../lib/leads';

export default function ProfileSetup({ initialProfile, onSave, onCancel }) {
  const [businessName, setBusinessName] = useState(initialProfile?.businessName || '');
  const [trade, setTrade] = useState(initialProfile?.trade || '');
  const [serviceArea, setServiceArea] = useState(initialProfile?.serviceArea || '');
  const [availability, setAvailability] = useState(initialProfile?.availability || '');
  const [tone, setTone] = useState(initialProfile?.tone || TONE_OPTIONS[0].value);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!businessName.trim() || !trade.trim() || !serviceArea.trim()) {
      setError('Business name, trade, and service area are required.');
      return;
    }
    onSave({
      businessName: businessName.trim(),
      trade: trade.trim(),
      serviceArea: serviceArea.trim(),
      availability: availability.trim(),
      tone,
    });
  }

  return (
    <div className="profile-setup">
      <form className="profile-setup__form" onSubmit={handleSubmit}>
        <h1>{initialProfile ? 'Edit business profile' : 'Set up your business'}</h1>
        <p className="profile-setup__intro">
          This helps generate follow-up replies that sound like you.
        </p>

        <label>
          Business name
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Acme Plumbing"
          />
        </label>

        <label>
          Trade / services
          <input
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            placeholder="Residential plumbing repair and installation"
          />
        </label>

        <label>
          Service area
          <input
            value={serviceArea}
            onChange={(e) => setServiceArea(e.target.value)}
            placeholder="Greater Denver metro"
          />
        </label>

        <label>
          Availability notes <span className="optional">(optional)</span>
          <textarea
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            placeholder="Mon-Fri 8am-5pm, emergency calls anytime"
            rows={2}
          />
        </label>

        <label>
          Tone
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="profile-setup__actions">
          {onCancel && (
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
