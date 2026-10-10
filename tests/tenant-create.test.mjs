import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { portfolioOrigin } from '../src/app/views/LandingPages/portfolio-origin.js';

test('external companies require separate opt-ins and allowed roles for Create and property catalog', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { canAccessModule } = await server.ssrLoadModule('/src/app/constants/navigation.js');
    for (const role of ['admin', 'asesor', 'director']) {
      const user = { role, organizationId: 'adoquin' };
      for (const [module, feature] of [['lp', 'landingPages'], ['e', 'erp']]) {
        assert.equal(canAccessModule(module, user, { features: {} }), false);
        assert.equal(canAccessModule(module, user, { features: { [feature]: true } }), true);
        assert.equal(canAccessModule(module, { ...user, crmOnly: true }, { features: { [feature]: true } }), false);
        assert.equal(canAccessModule(module, { ...user, role: 'colaborador' }, { features: { [feature]: true } }), false);
      }
    }
    const { catalogToLandingProps, encodeLanding, decodeLanding } = await server.ssrLoadModule('/src/app/views/LandingPages/catalogAdapter.js');
    assert.deepEqual(catalogToLandingProps([]), []);
    const props = catalogToLandingProps([{ id: 'catalogo', items: [{ id: 'own', desarrollo: 'Adoquin QA', origen: 'app', clasificacion: null, ubicacion: null, contacto: 'private', masterbroker: 'private' }] }]);
    assert.equal(props.length, 1);
    assert.equal(props[0].id, 'db:own');
    assert.equal(JSON.stringify(props).includes('private'), false);
    const decoded = decodeLanding(encodeLanding({ agencyName: 'Adoquín Inmobiliaria', asesorWA: '+529842779519', properties: props }));
    assert.equal(decoded.agencyName, 'Adoquín Inmobiliaria');
    assert.equal(decoded.asesorWA, '+529842779519');
    assert.equal(decoded.properties[0].name, 'Adoquin QA');
  } finally { await server.close(); }
});

test('native and localhost portfolios use the public HTTPS site', () => {
  for (const origin of ['capacitor://localhost', 'http://localhost', 'https://localhost', 'http://127.0.0.1:5174', 'null']) {
    assert.equal(portfolioOrigin(origin), 'https://stratoscapitalgroup.com');
  }
  assert.equal(portfolioOrigin('https://stratoscapitalgroup.com'), 'https://stratoscapitalgroup.com');
});
