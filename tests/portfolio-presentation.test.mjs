import test from 'node:test';
import assert from 'node:assert/strict';
import { safePortfolioUrl, portfolioPrice, portfolioWhatsApp, portfolioAccent } from '../src/app/views/LandingPages/portfolio-presentation.js';

test('material and appointment links accept web URLs and reject executable or malformed links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', '//external.com', '', undefined]) assert.equal(safePortfolioUrl(url), null);
  assert.equal(safePortfolioUrl('https://maps.google.com/?q=Tulum'), 'https://maps.google.com/?q=Tulum');
});
test('prices keep catalog wording and never invent missing prices or round away meaningful amounts', () => {
  assert.equal(portfolioPrice({ ticket: '450k < +' }), '450k < +');
  assert.equal(portfolioPrice({ priceFrom: 0 }), 'Consultar precio');
  assert.equal(portfolioPrice({ priceFrom: 'bad' }), 'Consultar precio');
  assert.match(portfolioPrice({ priceFrom: 250500, priceTo: 300900 }), /250,500.*300,900/);
  assert.match(portfolioPrice({ priceFrom: 250500 }), /^Desde.*250,500/);
});
test('advisor contact carries only the chosen properties and preserves the advisor number', () => {
  const url = new URL(portfolioWhatsApp('984 123 4567', 'Ana', [{ name: 'Casa & Mar' }]));
  assert.equal(url.pathname, '/529841234567');
  assert.match(url.searchParams.get('text'), /Hola Ana.*Casa & Mar/);
  assert.equal(portfolioWhatsApp('', 'Ana', []), null);
  assert.equal(portfolioWhatsApp('123', 'Ana', []), null);
  assert.match(portfolioWhatsApp('+1 202 555 0123', 'Ana', []), /wa.me\/12025550123/);
});

test('personal priorities are encoded as text in the advisor consultation', () => {
  const url = new URL(portfolioWhatsApp('9841234567', 'Ana', [{ name: 'Casa' }], '  Plano & pagos\n¿Terraza?  '));
  assert.match(url.searchParams.get('text'), /Mis prioridades y dudas:\nPlano & pagos\n¿Terraza\?/);
  assert.equal(url.searchParams.size, 1);
  assert.doesNotMatch(new URL(portfolioWhatsApp('9841234567', 'Ana', [], '  ')).searchParams.get('text'), /Mis prioridades/);
});

test('property accents retain catalog color and reject unsafe CSS with a readable fallback', () => {
  assert.equal(portfolioAccent('#6EE7C2')['--pd-property-color'], '#6EE7C2');
  assert.equal(portfolioAccent(' #abc ')['--pd-property-color'], '#aabbcc');
  for (const invalid of [null, '#12', 'red;display:none', 'url(https://example.com)', {}]) {
    assert.deepEqual(portfolioAccent(invalid), portfolioAccent('#7BA8E0'));
  }
  assert.equal(portfolioAccent('#000')['--pd-property-ink'], 'rgb(153, 153, 153)');
  assert.equal(portfolioAccent('#fff')['--pd-property-ink'], 'rgb(255, 255, 255)');
});
