import { useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import ProfileSetup from './components/ProfileSetup';
import Sidebar from './components/Sidebar';
import LeadThread from './components/LeadThread';
import NewLeadModal from './components/NewLeadModal';
import { DEFAULT_CADENCE, STAGE, migrateLeads, nextTicketNumber } from './lib/leads';
import { DEMO_PROFILE, createDemoLeads } from './lib/demoData';
import './App.css';

// Keep in sync with the `max-width: 767px` breakpoint in App.css.
const DESKTOP_QUERY = '(min-width: 768px)';
const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

function App() {
  const [profile, setProfile] = useLocalStorage('lfa.profile', null);
  // migrateLeads upgrades anything saved under the old single-status model.
  const [leads, setLeads] = useLocalStorage('lfa.leads', [], migrateLeads);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isNewLeadOpen, setNewLeadOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  function handleLoadDemo() {
    const demoLeads = createDemoLeads();
    setProfile(DEMO_PROFILE);
    setLeads(demoLeads);
    // Desktop shows both panes, so opening the first lead makes the demo look
    // populated straight away. On mobile that would bury the lead list behind
    // a thread view, so start on the list instead.
    setSelectedLeadId(isDesktop() ? demoLeads[0].id : null);
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
    setSelectedLeadId(lead.id);
    setNewLeadOpen(false);
  }

  return (
    // data-view drives the mobile single-pane switch: under 768px the CSS
    // shows only the list or only the thread. Desktop ignores it and keeps
    // both panes side by side.
    <div className="dashboard" data-view={selectedLead ? 'thread' : 'list'}>
      <Sidebar
        profile={profile}
        leads={leads}
        selectedLeadId={selectedLeadId}
        onSelectLead={setSelectedLeadId}
        onNewLead={() => setNewLeadOpen(true)}
        onEditProfile={() => setIsEditingProfile(true)}
        onResetDemo={handleResetDemo}
      />
      <LeadThread
        key={selectedLead?.id}
        profile={profile}
        lead={selectedLead}
        onUpdateLead={(updater) => selectedLead && updateLead(selectedLead.id, updater)}
        onBack={() => setSelectedLeadId(null)}
      />
      {isNewLeadOpen && (
        <NewLeadModal onCreate={handleCreateLead} onClose={() => setNewLeadOpen(false)} />
      )}
    </div>
  );
}

export default App;
