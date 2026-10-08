import { createContext } from 'react';
import { DEFAULT_CLIENT_CONFIG } from '../clients/_shared/defaults.js';
import { crearValorCliente } from '../clients/_shared/client-value.js';

export const guestConfig = {
  ...DEFAULT_CLIENT_CONFIG,
  id: 'guest', name: 'Stratos AI', legalName: 'Empresa ficticia',
  tenant: { ...DEFAULT_CLIENT_CONFIG.tenant, clientId: 'guest', organizationId: 'deded000-0000-4000-a000-000000000001', botUsername: '', copilotWebhook: null },
  brand: { ...DEFAULT_CLIENT_CONFIG.brand, appWordmark: 'Stratos AI' },
  support: { email: null, whatsapp: null, phoneLabel: null },
  features: { ...DEFAULT_CLIENT_CONFIG.features, copilotModule: true, comandoDirectivo: true, procesoGuiado: false, teamAdmin: false, teamChat: false, whatsappModule: false },
};
export const ClientContext = createContext(crearValorCliente(guestConfig));
