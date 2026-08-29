import { useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import ProfileSetup from './components/ProfileSetup';
import Sidebar from './components/Sidebar';
import LeadThread from './components/LeadThread';
import NewLeadModal from './components/NewLeadModal';
import { nextTicketNumber } from './lib/leads';
import { DEMO_PROFILE, createDemoLeads } from './lib/demoData';
import './App.css';

function App() {
  const [profile, setProfile] = useLocalStorage('lfa.profile', null);
  const [leads, setLeads] = useLocalStorage('lfa.leads', []);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isNewLeadOpen, setNewLeadOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  function handleLoadDemo() {
    const demoLeads = createDemoLeads();
    setProfile(DEMO_PROFILE);
    setLeads(demoLeads);
    setSelectedLeadId(demoLeads[0].id);
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
      status: 'new',
      messages: [
        { id: crypto.randomUUID(), sender: 'customer', text: message.trim(), at: Date.now() },
      ],
      followUpAt: null,
      draftReply: '',
      createdAt: Date.now(),
    };
    setLeads((prev) => [lead, ...prev]);
    setSelectedLeadId(lead.id);
    setNewLeadOpen(false);
  }

  return (
    <div className="dashboard">
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
      />
      {isNewLeadOpen && (
        <NewLeadModal onCreate={handleCreateLead} onClose={() => setNewLeadOpen(false)} />
      )}
    </div>
  );
}

export default App;
