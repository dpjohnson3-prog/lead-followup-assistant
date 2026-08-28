import { isFollowUpOverdue } from '../lib/leads';

export default function Sidebar({
  profile,
  leads,
  selectedLeadId,
  onSelectLead,
  onNewLead,
  onEditProfile,
}) {
  const dueCount = leads.filter(isFollowUpOverdue).length;

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h2>{profile.businessName}</h2>
        <p className="sidebar__trade">{profile.trade}</p>
      </div>

      <button type="button" className="btn btn--primary sidebar__new-lead" onClick={onNewLead}>
        + New lead
      </button>

      {dueCount > 0 && (
        <div className="sidebar__banner">
          {dueCount} lead{dueCount === 1 ? '' : 's'} due for follow-up
        </div>
      )}

      <ul className="sidebar__list">
        {leads.length === 0 && <li className="sidebar__empty">No leads yet</li>}
        {leads.map((lead) => {
          const overdue = isFollowUpOverdue(lead);
          const lastMessage = lead.messages[lead.messages.length - 1];
          const classes = ['sidebar__lead'];
          if (lead.id === selectedLeadId) classes.push('sidebar__lead--active');
          if (overdue) classes.push('sidebar__lead--overdue');

          return (
            <li key={lead.id}>
              <button
                type="button"
                className={classes.join(' ')}
                onClick={() => onSelectLead(lead.id)}
              >
                <div className="sidebar__lead-row">
                  <span className="sidebar__lead-name">
                    {lead.customerName || 'Unnamed lead'}
                  </span>
                  <span className="sidebar__lead-ticket">#{lead.ticketNumber}</span>
                </div>
                <p className="sidebar__lead-preview">{lastMessage?.text}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="sidebar__edit-profile" onClick={onEditProfile}>
        Edit business profile
      </button>
    </aside>
  );
}
