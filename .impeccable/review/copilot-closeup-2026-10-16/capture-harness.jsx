// Local capture only. The production component and demo engine are unchanged here.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Copilot from '../../../src/app/views/Copilot.jsx';
import { AuthContext } from '../../../src/contexts/AuthContext.jsx';
import { guestUser } from '../../../src/guest/AuthContext.jsx';
import { createDemoLeads } from '../../../src/app/data/demo-leads.js';
import { LP } from '../../../src/design-system/tokens.js';
import '../../../src/index.css';
createRoot(document.getElementById('root')).render(
  <AuthContext.Provider value={{ user: guestUser, loading: false }}>
    <main id="capture-module" style={{ width:684, height:474, display:'flex', background:LP.bg }}>
      <Copilot theme="light" T={LP} demoContext={{ leads:createDemoLeads(), tasks:[] }} />
    </main>
  </AuthContext.Provider>
);
