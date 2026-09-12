import { useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import ProfileSetup from './components/ProfileSetup';
import Sidebar from './components/Sidebar';
import LeadThread from './components/LeadThread';
import NewLeadModal from './components/NewLeadModal';
import { DEFAULT_CADENCE, STAGE, dueLeads, migrateLeads, nextTicketNumber } from './lib/leads';
import DueToday from './components/DueToday';
import { DEMO_PROFILE, createDemoLeads } from './lib/demoData';
import './App.css';

function App() {
  const [profile, setProfile] = useLocalStorage('lfa.profile', null);
  // migrateLeads upgrades anything saved under the old single-status model.
  const [leads, setLeads] = useLocalStorage('lfa.leads', [], migrateLeads);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  // Decided once on mount: when work is waiting, the queue is what he opens to.
  const [showDue, setShowDue] = useState(() => dueLeads(leads).length > 0);
  const [isNewLeadOpen, setNewLeadOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  function handleLoadDemo() {
    const demoLeads = createDemoLeads();
    setProfile(DEMO_PROFILE);
    setLeads(demoLeads);
    // The demo has an overdue lead, so it lands on the queue like a real
    // morning would.
    setSelectedLeadId(null);
    setShowDue(true);
    setIsEditingProfile(false);
  }

  function handleResetDemo() {
    const confirmed = window.confirm(
      'Reset will delete the business profile and all leads on this device. Continue?',
    );
    if (!confirmed) return;
    setProfile(null);
    setLeads([]);
    setSelectedLeadId(null);
    setShowDue(false);
    setNewLeadOpen(false);
    setIsEditingProfile(false);
  }

  if (!profile || isEditingProfile) {
    return (
      <ProfileSetup
        initialProfile={profile}
        onSave={(nextProfile) => {
          setProfile(nextProfile);
          setIsEditingProfile(false);
        }}
        onCancel={profile ? () => setIsEditingProfile(false) : undefined}
        onLoadDemo={profile ? undefined : handleLoadDemo}
      />
    );
  }

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;
  const due = dueLeads(leads);
  // Falls back to the lead list on its own once the queue is emptied.
  const view = selectedLead ? 'thread' : showDue && due.length ? 'due' : 'list';

  function updateLead(id, updater) {
    setLeads((prev) => prev.map((lead) => (lead.id === id ? updater(lead) : lead)));
  }

  function handleCreateLead({ customerName, source, message }) {
    const lead = {
      id: crypto.randomUUID(),
      ticketNumber: nextTicketNumber(leads),
      customerName: customerName.trim(),
      source,
      stage: STAGE.NEW_LEAD,
      messages: [
        { id: crypto.randomUUID(), sender: 'customer', text: message.trim(), at: Date.now() },
      ],
      // The sequence starts when the quote goes out, not when the lead lands.
      cadence: DEFAULT_CADENCE,
      followUpAttempt: 0,
      lastContactAt: null,
      nextFollowUpAt: null,
      sequencePaused: false,
      draftReply: '',
      createdAt: Date.now(),
    };
    setLeads((prev) => [lead, ...prev]);
    setShowDue(false);
    setSelectedLeadId(lead.id);
    setNewLeadOpen(false);
  }

  return (
    // data-view drives the mobile single-pane switch: under 768px the CSS
    // shows only the list or only the thread. Desktop ignores it and keeps
    // both panes side by side.
    <div className="dashboard" data-view={view}>
      <Sidebar
        profile={profile}
        leads={leads}
        selectedLeadId={selectedLeadId}
        onSelectLead={setSelectedLeadId}
        dueCount={due.length}
        onShowDue={() => {
          setSelectedLeadId(null);
          setShowDue(true);
        }}
        onNewLead={() => setNewLeadOpen(true)}
        onEditProfile={() => setIsEditingProfile(true)}
        onResetDemo={handleResetDemo}
      />
      {view === 'due' ? (
        <DueToday
          profile={profile}
          leads={due}
          onUpdateLead={updateLead}
          onOpenLead={setSelectedLeadId}
          onShowAllLeads={() => setShowDue(false)}
        />
      ) : (
        <LeadThread
          key={selectedLead?.id}
          profile={profile}
          lead={selectedLead}
          onUpdateLead={(updater) => selectedLead && updateLead(selectedLead.id, updater)}
          onBack={() => setSelectedLeadId(null)}
        />
      )}
      {isNewLeadOpen && (
        <NewLeadModal onCreate={handleCreateLead} onClose={() => setNewLeadOpen(false)} />
      )}
    </div>
  );
}

export default App;
