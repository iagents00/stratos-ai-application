-- ════════════════════════════════════════════════════════════════════════
-- 088 — Sincronización profunda del excel de Ema (discoveries + calentitos)
-- ✅ APLICADA A PROD el 2026-07-10. Extracción del XLSX completo:
--   · Pestaña Reactivación: 6 discoveries COMPLETOS (Hugo, Lina, David,
--     Guido, Maricela, Elías) + comentarios ricos → campo discovery.
--   · Pestaña LEAD CALIENTES Y RECORRIDOS: 31 clientes con desarrollo de
--     interés, fecha de recorrido y notas → 22 registros enriquecidos +
--     14 zooms históricos insertados (solo existían en esa pestaña).
--   · 10 filas ROJAS del Zooms Agendados (calentitos marcados con color,
--     invisibles en CSV) → calentito=true.
-- Idempotente: matches por nombre normalizado (alias LUIZ/LUIS etc.) con
-- fecha ±1 día; COALESCE/position guards → re-ejecutar no duplica ni pisa.
-- Resultado verificado: 247 zooms · 30 calentitos · 14 con discovery ·
-- 29 con recorrido · 0 estatus inválidos.
-- ════════════════════════════════════════════════════════════════════════

WITH datos (cliente, n, fecha, hora, liner, pres, apoyo, proyecto, estatus, comentario, discovery, calentito) AS (VALUES
  ('HUGO', 'hugo', '2026-05-22', '10:00', 'Daniel Pavon', 'Oscar Gálvez', '', 'NAUTICA-AURORA', 'No show', 'CLIENTE NO SE CONECTO Y SE MOSTRABA INQUIETO POR INFORMACION ANTES DE ZOOM', 'Objetivo: Villa/ depa Renta vacacional y vacaciones personales Ubicación Riviera maya (Cancún de preferencia) Presupuesto: 300K DLLS FINANCIAMIENTO (banco o directo) 3 habitaciones Cliente toma decisión con su esposa Reunión Viernes 22 de mayo 10:00AM', false),
  ('LINA', 'lina', '2026-05-22', '19:00', 'Daniel Pavon', 'Oscar Gálvez', '', '', 'No show', 'DESPUES DE AGENDAR NO VOLVIO A RESPONDER LLAMADAS NI MENSAJES', 'LINA 
Objetivo: Departamento renta vacional y vacaciones personales 
Ubicación: Riviera Maya
Presupuesto: 200k DLLS
Notas: 1 hora menos que nosotros, Hondureña viviendo en florida, estará el viernes en honduras ya conoce México pero no la Riviera maya', false),
  ('DAVID', 'david', '2026-05-25', '15:00', 'Daniel Pavon', 'Oscar Gálvez', '', '', 'No show', 'DESPUES DE AGENDAR NO VOLVIO A RESPONDER LLAMADAS NI MENSAJES', 'Nombre: David Objetivo: Renta vacacional 
Ubicacion: Playa del Carmen/ Pto. Morelos
Presupuesto: $150-$200K dlls cash recurso propio 
Modelo de negocio Renta vacacional 
Notas:Cliente esta interesado de Unidad de negocio, está listo para invertir 
Preventa prioridad conoce Cancún 
$250,000 dlls tope
Decisiones solo
Reunión: lunes 25 de noviembre 3:00 pm horario local Playa Del Carmen', false),
  ('GUIDO', 'guido', '2026-06-01', '09:00', 'Daniel Pavon', 'Oscar Gálvez', '', '', 'No show', 'DESPUES DE AGENDAR NO VOLVIO A RESPONDER LLAMADAS NI MENSAJES', 'Se reactiva zoom  Discovery: Guido Objetivo 2 habitaciones 2 baños 
Renta vacacional Playa del Carmen y puerto Morelos 
Presupuesto: 200-250k USD Departamento o casa 
Notas: el cliente quería Puerto Vallarta, se le habló del ROI en esta parte del país, busca financiamiento 
Meet: lunes 1 a las 9:00am de nuestro horario
10 de Washington', false),
  ('MARICELA GUERROLA', 'maricela guerrola', '2026-05-28', '17:00', 'Daniel Pavon', 'Cecilia Dominguez', '', 'DIS. XCALACOCO, AURORA TOWERS THE LANDMARK', 'No show', 'SE CORTÓ EN MEDIO DE LA VIDEOLLAMADA, LA CLIENTE SE NOTABA EMOCIONADA POR LOS PROYECTOS, PERO SE DESCONECTO, NO CONTESTA LLAMADAS Y MENSAJES DE CECI NI DANIEL, TAMPOCO LE LLEGAN MENSAJES', 'Discovery Maricela 
Chicago/originaria de Jalisco 
Objetivo: Casa 200K USD RECURSO PROPIO 
Ubicación Riviera maya
Modelo de negocio: Entrega inmediata o preventa
La quiere para vacaciones y renta vacional 
MEET: Jueves 28 (mañana) 5:00pm horario Cancún/ Chicago', false),
  ('ELIAS', 'elias', '2026-06-02', '', 'Daniel Pavon', 'Cecilia Dominguez', '', '', 'No show', 'CLIENTE PIDE REAGENDAR DE ULTIMO MINUTO, LE LLEGO VISITAS', 'Elías 
$6,500,000MXN CASA RENTA VACACIONAL Playa del Carmen 
Entrega inmediata o preventa (Prefiere entrega inmediata 
Cliente es de florida 
NOTAS: Importante Cliente menciona que es “la primera vez qué compra por teléfono” si ya viene pensando en comprar remotamente probablem podamos cerrarlo en la videollamada 
Meet:Martes 2 (6:00pm hora Cancún)
(7:00pm hora Florida)', false),
  ('FABIÁN ARREOLA Y MÓNICA BECERRA', 'fabian arreola y monica becerra', '2026-04-05', '13:00', 'Cecilia Mendoza', 'Cecilia Mendoza', 'Cecilia Mendoza', 'VIEW TOWERS, AURORA TOWERS, BVG, ZENIT', 'Asistió', 'Recorrido: 6/6/2026 CANCÚN', '', true),
  ('ARTURO Y SANDRA VALENCIA', 'arturo y sandra valencia', '2026-05-08', '18:00', 'Cecilia Mendoza', 'Cecilia Mendoza', 'Cecilia Mendoza', 'AMARES, TCC, LEGACY DESIGN, AUKENA, PARAISO PLAYA ENCANTADA', 'Asistió', 'Recorrido: 26/6/2026 Terrenos                      27/6/2026 Casas PDC', '', true),
  ('MIGUEL Y JOHANA AQUILES', 'miguel y johana aquiles', '2026-05-22', '17:00', 'Carlos Ayala', 'Cecilia Mendoza', 'Ken Lugo', 'PUNTA LAGUNA, THE VILLAGE, DISTRITO XCALACOCO, GOBERNADOR 28', 'Asistió', 'Recorrido: No entró a reunión con HIR casa', '', true),
  ('RODRIGO GOMEZ', 'rodrigo gomez', '2026-06-01', '17:00', 'Carlos Ayala', 'Oscar Gálvez', 'Ken Lugo', 'BLUME , SHARK , SLS , LAYA , BVG , / IT BEACH , MIRANDA , MARILA , CRUZ CON MAR Y SINGULAR', 'Agendado', 'Recorrido: 9/6/2026 llega', '', true),
  ('CARLOS & ALEXANDRA', 'carlos y alexandra', '2026-05-28', '09:00', 'Gael Velasco', 'Duke del Caribe', '', 'AURORA TOWERS O SOLAR', 'Asistió', 'Recorrido: 13 DE JUNIO', 'APARTADO 18 DE JUNIO', true),
  ('OSCAR', 'oscar', '2026-05-29', '14:00', 'Gael Velasco', 'Duke del Caribe', '', 'PH 2103 AURORA TOWERS', 'Asistió', 'Recorrido: FECHA A DEFINIR', 'LLEGA EL lunes 15 de Junio a CDMX', true),
  ('CARIN', 'carin', '2026-05-28', '12:00', 'Carlos Ayala', 'Ken Lugo', 'Ken Lugo', 'LOMAS AURORA LOCALES, GOBERNADOR 28, SOLAR, ALUX 33', 'Asistió', '', '', true),
  ('ULYSSES', 'ulysses', '2026-06-27', '18:30', 'Daniel Pavon', 'Ken Lugo', 'Oscar Gálvez', 'BAY VIEW GRAND, SLS, LAHIA', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('Enrique', 'enrique', '2026-06-29', '19:00', 'Daniel Pavon', 'Oscar Gálvez', 'Oscar Gálvez', 'AURORA TOWERS Y ZENNIT', 'Asistió', 'Recorrido: Fecha a definir', '', true),
  ('OLAGUER BAUZA', 'olaguer bauza', '2026-06-04', '17:30', 'Daniel Pavon', 'Cecilia Mendoza', 'Cecilia Mendoza', 'VIEW TOWERS, AURORA TOWERS, THE LANDMARK', 'Asistió', 'Recorrido: No ha podido ver los proyectos su esposa Sandra porque están de viaje.', '', true),
  ('ADRIAN SOTO', 'adrian', '2026-05-30', '15:00', 'Gael Velasco', 'Gael Velasco', '', '305E AURORA TOWERS', 'Asistió', 'Recorrido: FECHA A DEFINIR', 'DIJO ESTAR OCUPADO POR EL SIGUIENTE MES ( CONTACTAR A FINALES DE JUNIO )', true),
  ('VERONICA QUEZADA', 'veronica', '2026-05-29', '12:00', 'Gael Velasco', 'Duke del Caribe', '', 'THE LANDMARK O MACONDO PLAYACAR', 'Asistió', 'Recorrido: FECHA A DEFINIR', 'SEGUNDA REUNION AGENDADA I 9 DE JUNIO 4:30 PM CANCUN', true),
  ('JORGE GOMEZ', 'jorge', '2026-05-28', '13:00', 'Gael Velasco', 'Duke del Caribe', '', '1003C AURORA TOWERS', 'Asistió', 'Recorrido: FECHA A DEFINIR', 'LLEGA EL Martes 9 de Junio a CDMX', true),
  ('HECTOR', 'hector', '2026-05-29', '09:00', 'Gael Velasco', 'Duke del Caribe', '', 'DK42 O SOLAR', 'Asistió', 'Recorrido: FECHA A DEFINIR', 'No contesto', true),
  ('YORDANIS', 'yordanis', '2026-05-27', '20:00', 'Gael Velasco', 'Duke del Caribe', '', '1004D AURORA TOWERS', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('LUIS CONTRACTING', 'luis contracting', '2026-05-25', '17:30', 'Gael Velasco', 'Duke del Caribe', '', '310 SOLAR', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('OSVALDO', 'osvaldo', '2026-05-19', '15:00', 'Gael Velasco', 'Duke del Caribe', '', 'SUNSET 3 MZ 53 LOTE 4 (LEGACY)', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('CARLOS CHAVEZ', 'carlos chavez', '2026-05-25', '21:00', 'Gael Velasco', 'Duke del Caribe', '', 'PH812 REAL AURORA', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('CRISTIAN ROMERO', 'cristian romero', '2026-05-27', '20:00', 'Gael Velasco', 'Duke del Caribe', '', 'TF 404 LOMAS AURORA', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('KARINA VALLEJO', 'karina', '2026-05-27', '16:00', 'Gael Velasco', 'Duke del Caribe', '', 'NUBBA-EVENUS O TERRENO AMARES', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('JESSIE', 'jessie', '2026-05-27', '11:30', 'Gael Velasco', 'Duke del Caribe', '', '1704D AURORA TOWERS', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('ARIAM', 'ariam', '2026-05-12', '18:00', 'Gael Velasco', 'Duke del Caribe', '', 'DK44 O LOMAS AURORA', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('CARLOS CLAVEL', 'carlos clavel', '2026-05-14', '19:00', 'Gael Velasco', 'Duke del Caribe', '', 'PH812 REAL AURORA', 'Asistió', 'Recorrido: 28 DE JULIO', '', true),
  ('ROBERTO', 'roberto', '2026-05-03', '18:00', 'Gael Velasco', 'Duke del Caribe', '', 'SUNSET 3 MZ 53 LOTE 4 (LEGACY)', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('CHARLES MASON', 'charles', '2026-06-05', '17:30', 'Gael Velasco', 'Gael Velasco', '', 'TF 404 LOMAS AURORA', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('JIMMEY', 'jimmey', '2026-06-05', '10:30', 'Gael Velasco', 'Gael Velasco', '', 'THE LANDMARK 202', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('CHARLY & RUBI', 'charly y rubi', '2026-06-05', '15:00', 'Gael Velasco', 'Gael Velasco', '', 'DK42 602', 'Asistió', 'Recorrido: FECHA A DEFINIR', 'PIDIO 3 MESES LLEGO A CARTA OFERTA JUNTO CON ID', true),
  ('YENNI BELTRAN', 'yenny', '2026-06-08', '12:00', 'Gael Velasco', 'Duke del Caribe', '', 'AURORA TOWERS', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('LUIZ LOPEZ', 'luis lopez', '2026-06-30', '13:00', 'Carlos Ayala', 'Ken Lugo', 'DUKE', 'VIEW TOWERS, SONY, LEGACY EN TULUM COUNTRY CLUB', 'Asistió', 'Recorrido: FECHA A DEFINIR', '', true),
  ('JUAN MENDOZA Y MALLORY', 'juan mendoza', '2026-07-02', '01:00', 'Gael Velasco', 'Cecilia Mendoza', 'Cecilia Mendoza', 'AURORA TOWERS, AUKENA, Y LOMAS AURORA', 'Asistió', 'Recorrido: 11/7/2026', 'ESTÁN REVISANDO FECHAS Y VUELOS PARA RECORRIDO EN JULIO', true)
),
upd AS (
  UPDATE zoom_agendados z
  SET calentito   = z.calentito OR d.calentito,
      discovery   = COALESCE(NULLIF(z.discovery,''), NULLIF(d.discovery,'')),
      proyecto    = COALESCE(NULLIF(z.proyecto,''), NULLIF(d.proyecto,'')),
      comentarios = CASE WHEN d.comentario = '' OR position(d.comentario in COALESCE(z.comentarios,'')) > 0 THEN z.comentarios
                         ELSE NULLIF(trim(both ' ·' from COALESCE(z.comentarios,'') || ' · ' || d.comentario), '') END
  FROM datos d
  WHERE z.id = (
    SELECT z2.id FROM zoom_agendados z2
    WHERE z2.organization_id = '00000000-0000-0000-0000-000000000001'
      AND length(regexp_replace(translate(lower(trim(z2.cliente)), 'áéíóúüñ&', 'aeiouuny'), '\s+', ' ', 'g')) >= 3
      AND (regexp_replace(translate(lower(trim(z2.cliente)), 'áéíóúüñ&', 'aeiouuny'), '\s+', ' ', 'g') = d.n
           OR position(regexp_replace(translate(lower(trim(z2.cliente)), 'áéíóúüñ&', 'aeiouuny'), '\s+', ' ', 'g') in d.n) > 0
           OR position(d.n in regexp_replace(translate(lower(trim(z2.cliente)), 'áéíóúüñ&', 'aeiouuny'), '\s+', ' ', 'g')) > 0)
      AND z2.fecha_zoom BETWEEN d.fecha::date - 1 AND d.fecha::date + 1
    ORDER BY (z2.estatus = 'Asistió') DESC, z2.fecha_zoom, z2.hora LIMIT 1)
  RETURNING d.n
),
ins AS (
  INSERT INTO zoom_agendados (organization_id, fecha_zoom, hora, liner, presentador_principal, presentador_apoyo, cliente, proyecto, estatus, comentarios, discovery, calentito)
  SELECT '00000000-0000-0000-0000-000000000001', d.fecha::date, NULLIF(d.hora,''), NULLIF(d.liner,''), NULLIF(d.pres,''), NULLIF(d.apoyo,''), d.cliente, NULLIF(d.proyecto,''), d.estatus, NULLIF(d.comentario,''), NULLIF(d.discovery,''), d.calentito
  FROM datos d WHERE d.n NOT IN (SELECT n FROM upd)
  RETURNING 1
)
SELECT (SELECT count(*) FROM upd) AS actualizados, (SELECT count(*) FROM ins) AS insertados;

UPDATE zoom_agendados z SET calentito = true
FROM (VALUES
  (DATE '2026-06-22','pedro lazaro'),(DATE '2026-06-22','leo'),(DATE '2026-06-22','jose huerta'),
  (DATE '2026-06-26','moises cabrera'),(DATE '2026-06-26','juventino gonzalez'),(DATE '2026-06-27','dalia de la o'),
  (DATE '2026-06-30','luis lopez'),(DATE '2026-07-01','juan carlos'),(DATE '2026-07-01','chris y jennifer'),(DATE '2026-07-03','ismael contreras')
) AS r(fecha, n)
WHERE z.organization_id = '00000000-0000-0000-0000-000000000001' AND z.fecha_zoom = r.fecha
  AND regexp_replace(translate(lower(trim(z.cliente)), 'áéíóúüñ&', 'aeiouuny'), '\s+', ' ', 'g') = r.n;