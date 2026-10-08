import { createContext } from 'react';

export const guestUser = Object.freeze({
  id: 'demo-user-local', name: 'Invitado', email: '', role: 'admin',
  organizationId: 'deded000-0000-4000-a000-000000000001',
  isDemo: true, isGuest: true, phone: null,
});
const leave = () => window.location.assign('/index.html?app');
export const AuthContext = createContext({
  user: guestUser, loading: false, error: null, bootHydrating: false,
  login: async () => ({ error: 'Sal de la demo para iniciar sesión.' }),
  logout: leave, upgradeToOnline: leave,
});
