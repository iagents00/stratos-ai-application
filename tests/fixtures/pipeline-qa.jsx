// Local browser fixture. Tests intercept all requests with synthetic data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import PipelineConfiguratorAdmin from '../../src/app/features/Admin/PipelineConfiguratorAdmin';
import { LP } from '../../src/design-system/tokens';
const globalMode = new URLSearchParams(location.search).has('global');
createRoot(document.getElementById('root')).render(
  <PipelineConfiguratorAdmin T={LP} organizationId={globalMode ? undefined : 'qa-own'} onBack={() => {}} />
);
