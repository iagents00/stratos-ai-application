-- ═══════════════════════════════════════════════════════════════════════════
-- 056 · Seed inicial del catálogo de Propiedades — Duke del Caribe, plaza Tulum
-- ─────────────────────────────────────────────────────────────────────────────
-- Importación única desde el Google Sheet "DRIVES DUKE DEL CARIBE" (pestaña
-- DRIVES DC, matriz por asesor). Links extraídos de los hipervínculos reales
-- del sheet. De aquí en adelante la fuente de verdad es la tabla `properties`
-- (se administra en CRM → Propiedades).
--
-- Correcciones hechas al importar (el sheet original tenía 2 links dañados):
--   · NAIA NAAY: la URL decía "naayrive.google.com" (texto pegado al dominio);
--     se restauró el dominio drive.google.com con el mismo ID de carpeta.
--   · GREEN DREAM y CASA CHECHEN: URLs con formato /u/N/ o /mobile/ se
--     normalizaron al formato estándar /drive/folders/<id>.
-- Idempotente: no duplica si ya existe (org + nombre + plaza).
-- ═══════════════════════════════════════════════════════════════════════════

with duke as (
  select '00000000-0000-0000-0000-000000000001'::uuid as org
), data (name, price_tier, highlights, drive_url, recommended_by) as (
  values
  -- ── KEN ──
  ('NAJ ORIGEN',      '80-150K',  'Acabados, buen precio',                    'https://drive.google.com/drive/folders/1565H46OACLndhdzWYwoIKEOOYEWVWXWl', 'Ken'),
  ('NAIA NAAY',       '80-150K',  '2 recámaras, mejor precio por m²',         'https://drive.google.com/drive/folders/1h0YrpkeBWuQeLnLnChSYVIWZe4FTrrNx', 'Ken'),
  ('COCAY PI',        '80-150K',  'Estudios, unidad de negocio',              'https://drive.google.com/drive/folders/10wixh9XkSQCb-UaiW4rRtdbqwmD3LTo2', 'Ken'),
  ('KUKULKAN (MENESSE)', '200-350K', 'Precio y cercanía al mar',              'https://drive.google.com/drive/folders/1hZ4yBLQPW8Xf7aA7fhsaw2It1yxzbrpN', 'Ken'),
  ('NOIL HOUSES',     '200-350K', 'Precio y cercanía al mar',                 'https://drive.google.com/drive/folders/12wHuNDEWQatjXb7IcrN848P2VowogOUy', 'Ken'),
  ('CASA CHECHEN',    '200-350K', 'Espacio privado, buen m²/precio',          'https://drive.google.com/drive/folders/1EzG-2f8wW9_D6PL6jhtkSmHKR-Uo1rdT', 'Ken'),
  ('ONIRIC',          '500-800K', 'Proyecto diferente',                       'https://drive.google.com/drive/folders/1yt-2pZTv_ZMmNQmLteeQBjYtZtC3WF2N', 'Ken'),
  ('ADORA',           '500-800K', 'Calidad, cenote plus',                     'https://drive.google.com/drive/folders/1QVr_65OTkM8HHD1CEvnKHHRqechsZ2eB', 'Ken'),
  ('BULUC',           '500-800K', 'Proyecto retiro privado',                  'https://drive.google.com/drive/folders/1QQcwGwK1O5vps8UjLVqhKd7lZ_tXK4F9', 'Ken'),
  ('VILLAS SOHO',     'LUXURY',   'El mejor río de Tulum',                    'https://drive.google.com/drive/folders/1IStG95M9sgVE1gJxuoHVYHUxw63u0a2i', 'Ken'),
  ('GREEN DREAM',     'LUXURY',   'Proyecto zen / retiro',                    'https://drive.google.com/drive/folders/1lLHvzte1QgwLyrcfp3gSs6EbQbS46YrH', 'Ken'),
  ('AQUALUNA',        'LUXURY',   'Proyecto beach front',                     null,                                                                        'Ken'),
  -- ── FER ──
  ('VIVA RESIDENCES', '80-150K',  null,                                       null,                                                                        'Fer'),
  ('AMIRA DISTRICT',  '200-350K', 'Proyecto más cercano a la playa',          'https://drive.google.com/drive/folders/10Q1m15Rh5mTBg0N1-ZrCBlhG-r40X5QM', 'Fer'),
  ('ATMAN PLACE',     '200-350K', 'Villas con mejor ROI el año pasado',       'https://drive.google.com/drive/folders/1NqnpoY4hxCMsKLI7JY4PeUnxcr0-4NLJ', 'Fer'),
  ('WABI TULUM',      '200-350K', 'Concepto diferente',                       'https://drive.google.com/drive/folders/13azXXhygynriPQRZ4J4ey0spQrdmDR9M', 'Fer'),
  ('SENZIK',          '500-800K', 'Exclusividad y seguridad dentro de TCC',   'https://drive.google.com/drive/folders/1NFEzpkRKhDngbK7jFeIBcKwuwEoS9C6h', 'Fer'),
  ('VILLAS TOH',      '500-800K', 'Buen ROI anual',                           'https://drive.google.com/drive/folders/1O27TrrK4d-id6yhZwQVeVJLRDKnFzhzU', 'Fer'),
  ('KABANA',          '500-800K', null,                                       null,                                                                        'Fer'),
  ('VILLAS CANDELA',  'LUXURY',   'Diseños únicos',                           'https://drive.google.com/drive/folders/1kzIZIMPQ1AsYJVDUiDi9q5TaToEN2kX6', 'Fer')
)
insert into public.properties (organization_id, name, plaza, price_tier, highlights, drive_url, recommended_by)
select duke.org, d.name, 'Tulum', d.price_tier, d.highlights, d.drive_url, d.recommended_by
from data d, duke
where not exists (
  select 1 from public.properties p
  where p.organization_id = duke.org
    and lower(p.name) = lower(d.name)
    and lower(p.plaza) = 'tulum'
);
