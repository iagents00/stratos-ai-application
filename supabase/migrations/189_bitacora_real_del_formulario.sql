-- ⚠️ NUMERACIÓN: se aplicó a Supabase con el nombre `184_bitacora_real_del_formulario`.
-- El archivo va con 189 porque 184 ya estaba tomado por otra sesión que trabajaba en
-- paralelo. Ver la nota de la migración 188.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 189 — La bitácora real del equipo (hoja Form_Responses), transcrita
--
-- Reportan CINCO personas de TRES áreas, no solo marketing: Yazmin Ledesma,
-- Luis Ángel Landeros y Emmanuel Sánchez (Marketing) + Emmanuel Ortiz
-- (Gerente de Ventas) + Carolina Curiel (Postventa). Por eso el «Puesto/Área»
-- se guarda en la fila (columna `area`, migración 188) en vez de deducirse del
-- rol: deducirlo ponía a Ortiz y a Curiel en «Administración».
--
-- ⚠️ ORIGEN: 'captura-forms'. Estas filas se transcribieron de una CAPTURA de
-- la hoja, no del archivo: varios textos venían cortados por el ancho de la
-- pantalla y terminan en «…». Son fieles hasta donde se alcanzaba a leer.
-- Con acceso a la hoja Form_Responses se completan sin perder nada: el texto
-- se re-escribe sobre la misma fila, que ya es editable desde el CRM.
--
-- Solo AGREGA, y es idempotente (empareja por profile_id + created_at, así que
-- correrla dos veces no duplica). Para revertir: borrar las filas con
-- origen = 'captura-forms'.
-- ═══════════════════════════════════════════════════════════════════════════

insert into mkt_daily_reports (organization_id, profile_id, fecha, texto, area, brand_id, evidencia_url, origen, created_at)
select '00000000-0000-0000-0000-000000000001'::uuid, d.pid, d.fecha, d.texto, d.area,
       (select id from mkt_brands where organization_id='00000000-0000-0000-0000-000000000001' and slug=d.marca limit 1),
       d.evi, 'captura-forms', d.ts
from (values
('90442ec3-e2dc-42bf-bb2b-4d4cba2ec872'::uuid,'2026-07-16'::date,'Marketing','brazo-y-piedra','https://drive.google.com/open?id=','2026-07-16 21:43:28+00'::timestamptz,'3. Ajustes al tapial de Casa Sol y Luna.
4. Corrección y adaptación del formato de imagen a las medidas correspondientes en Adobe Illustrator.
5. Rediseño de la base visual en Adobe Photoshop utilizando las imágenes correctas para ajustarla al nuevo formato.
6. Reorganización y alineación de los elementos gráficos dentro del archivo final en Illustrator.'),
('68fb9b32-1ae8-47d3-81ed-8e8ee12b1d31'::uuid,'2026-07-17'::date,'Marketing','duke-del-caribe','https://drive.google.com/open?id=','2026-07-17 16:29:05+00'::timestamptz,'Respaldar videos de grabación y procesos administrativos 40min
movimiento del equipo al segundo piso contando que es una pc de escritorio 7 min
edición de casa Aldea Greta 7 hrs, al 90% (faltan tipografías y pulir color, 12 min)
Junta de retroalimentación y meet con Ivan acerca del CRM 50 min'),
('90442ec3-e2dc-42bf-bb2b-4d4cba2ec872'::uuid,'2026-07-17'::date,'Marketing','brazo-y-piedra',NULL,'2026-07-17 16:48:45+00'::timestamptz,'Creación del arte promocional para la Final del Mundial (España vs. Argentina) para redes sociales de Brasa & Piedra.
Diseño del arte "La recta final comienza" para comunicar el cierre de la campaña mundialista y el último fin de semana de la dinámica.
Diseño del arte informativo "¿Cómo elegiremos al ganador?" explicando la mecánica del sorteo y el proceso de entrega del premio.
Diseño del arte "El Mundial está por terminar" para comunicar el cierre del Pasaporte Mundialista e incentivar la participación antes de finalizar la cam…
Diseño del arte "¿Todavía te faltan sellos?" para promover la última oportunidad de completar el Pasaporte Mundialista y participar en la tómbola.
Actualización de datos del documento membretado de Duke del Caribe y reconstrucción completa del archivo al no contar con el editable original.
Reunión de seguimiento con Alejandro para revisar los temas tratados en la reunión con dirección, analizar observaciones y definir posibles ajustes pa…'),
('5c952100-6390-4bf0-8d37-ff3cc35cb173'::uuid,'2026-07-17'::date,'Marketing','brazo-y-piedra','https://drive.google.com/open?id=','2026-07-17 17:01:35+00'::timestamptz,'9 a 9:50 respaldo de documentos de levantamiento de contenido del día previo y de material de Brasa y Piedra hacia el disco duro y a mi computadora…'),
('5793c2a3-e3d8-4f59-ae3f-cda8128b272f'::uuid,'2026-07-17'::date,'Gerente de Ventas',NULL,'https://drive.google.com/open?id=','2026-07-17 19:29:51+00'::timestamptz,'Actividades en la foto de la captura del drive de la bitácora diaria'),
('68fb9b32-1ae8-47d3-81ed-8e8ee12b1d31'::uuid,'2026-07-20'::date,'Marketing',NULL,NULL,'2026-07-20 16:48:16+00'::timestamptz,'Checar ingreso, encender la computadora, (30 seg) revisar si el equipo esta listo para la junta de los lunes (5 min) Prepara el equipo y grabar la junta (1…'),
('5c952100-6390-4bf0-8d37-ff3cc35cb173'::uuid,'2026-07-20'::date,'Marketing',NULL,NULL,'2026-07-20 16:56:27+00'::timestamptz,'9:10 café, 9:20- 10:00 planeación y orden de video de junta (inventario, luces, orden). Junta 10:00 a 10:50. 10:50 a 11:10 respaldo de material grabado 1…'),
('5793c2a3-e3d8-4f59-ae3f-cda8128b272f'::uuid,'2026-07-20'::date,'Gerente de Ventas',NULL,'https://drive.google.com/open?id=','2026-07-20 18:25:48+00'::timestamptz,'Bitácora en la foto y drive'),
('90442ec3-e2dc-42bf-bb2b-4d4cba2ec872'::uuid,'2026-07-17'::date,'Marketing','brazo-y-piedra',NULL,'2026-07-21 08:42:03+00'::timestamptz,'1. Apoyo a Gael con la impresión de aproximadamente 15 hojas de documentación para presentar con clientes.
2. Participación en la reunión general de seguimiento, la cual finalizó aproximadamente a las 11:00 a. m.
3. Reinstalación y conexión de la impresora para poder realizar las impresiones, debido a que había sido retirada de su lugar para la reunión.
4. Apoyo a Leonardo con la impresión de la factura de la motocicleta que se entregaría al día siguiente, correspondiente a 3 copias.
5. Organización y priorización de los pendientes de la semana después de la reunión.
6. Inicio del desarrollo de propuestas gráficas para promocionar el Private Room de Brasa & Piedra, actividad que continúa en proceso.
7. Seguimiento y organización de pendientes relacionados con publicidad, contenido para redes sociales y materiales de Brasa & Piedra.
8. Traslado y jornada de trabajo presencial en Brasa & Piedra de 2:45 p. m. a 9:00 p. m. para realizar ajustes urgentes al menú del sitio web.
9. Actualización de precios, acomodo de categorías de platillos y modificación de descripciones del menú, trabajando en conjunto con el gerente…'),
('e6681c25-7875-45f6-a1d0-23a367daeb7f'::uuid,'2026-07-20'::date,'Postventa',NULL,NULL,'2026-07-21 10:25:32+00'::timestamptz,'búsqueda de propiedades a través de diferentes plataformas como THE RED SEARCH, Facebook y Google, de high ticket, así también buscado crecer c…'),
('68fb9b32-1ae8-47d3-81ed-8e8ee12b1d31'::uuid,'2026-07-21'::date,'Marketing','duke-del-caribe','https://drive.google.com/open?id=','2026-07-21 16:47:55+00'::timestamptz,'Edición de Villa Amayal final y con cambios (4hrs) Generar cortinilla de salida con IA (1 hr) por multiples intentos y promts ademas de edición de imag…'),
('5c952100-6390-4bf0-8d37-ff3cc35cb173'::uuid,'2026-07-21'::date,'Marketing','brazo-y-piedra','https://drive.google.com/open?id=','2026-07-21 16:58:11+00'::timestamptz,'9:10 a 10:10 Café, curaduría de videos para el video de Concurso Betty Procedimiento en tiempo real. 10:00 a 02:00 pm video para formato de TV, diál…'),
('5793c2a3-e3d8-4f59-ae3f-cda8128b272f'::uuid,'2026-07-21'::date,'Gerente de Ventas',NULL,'https://drive.google.com/open?id=','2026-07-22 11:32:38+00'::timestamptz,'Bitácora en la foto'),
('68fb9b32-1ae8-47d3-81ed-8e8ee12b1d31'::uuid,'2026-07-22'::date,'Marketing','brazo-y-piedra',NULL,'2026-07-22 17:45:38+00'::timestamptz,'Planeación de grabación el dia de hoy en brasa y piedra. Ejecución de Planeación grabando 3 cócteles 3 speech de explicación de preparación de los r…'),
('5c952100-6390-4bf0-8d37-ff3cc35cb173'::uuid,'2026-07-22'::date,'Marketing','brazo-y-piedra','https://drive.google.com/open?id=','2026-07-22 18:15:35+00'::timestamptz,'9:10 a 10 preparación de equipo para Grabación de Mixologia restante Brasa y Piedra, 10 a 12:30 pm edición de video Betty y montaje de voz en off 12…'),
('e6681c25-7875-45f6-a1d0-23a367daeb7f'::uuid,'2026-07-22'::date,'Postventa',NULL,NULL,'2026-07-22 19:13:15+00'::timestamptz,'búsqueda de propiedades y seguimiento con agencias y brokers para coordinar fechas para rodaje y filmación, pendiente por confirmar casa COCO a…'),
('5793c2a3-e3d8-4f59-ae3f-cda8128b272f'::uuid,'2026-07-22'::date,'Gerente de Ventas',NULL,'https://drive.google.com/open?id=','2026-07-23 02:16:46+00'::timestamptz,'Actividades en la foto de la bitácora'),
('68fb9b32-1ae8-47d3-81ed-8e8ee12b1d31'::uuid,'2026-07-23'::date,'Marketing','duke-del-caribe','https://drive.google.com/open?id=','2026-07-23 16:44:11+00'::timestamptz,'Respaldar Videos grabados el día de ayer, organizar las tomas del modrian y las tomas de los músicos de brasa, edición de video Mondrian historias, e…'),
('5c952100-6390-4bf0-8d37-ff3cc35cb173'::uuid,'2026-07-23'::date,'Marketing','brazo-y-piedra','https://drive.google.com/open?id=','2026-07-23 17:06:23+00'::timestamptz,'9:10 a 10:10 finalización y entrega de video final con correcciones Betty. 10:10 a 2 video Promo 4 Negroni y generación de fondos para animación en B…'),
('5793c2a3-e3d8-4f59-ae3f-cda8128b272f'::uuid,'2026-07-23'::date,'Gerente de Ventas',NULL,'https://drive.google.com/open?id=','2026-07-23 22:36:50+00'::timestamptz,'Actividades en la foto'),
('90442ec3-e2dc-42bf-bb2b-4d4cba2ec872'::uuid,'2026-07-21'::date,'Marketing','brazo-y-piedra',NULL,'2026-07-24 09:20:32+00'::timestamptz,'1. Desarrollo de cuatro propuestas gráficas para promocionar el Private Room de Brasa & Piedra (tres propuestas para post y una para historia).
2. Transferencia de los archivos RAW (.CR2) correspondientes a la sesión fotográfica de bebidas de Brasa & Piedra.
3. Proceso de selección y clasificación de fotografías para edición.
4. Inicio del proceso de edición fotográfica en Adobe Lightroom.
5. Respaldo de los archivos RAW en Google Drive para su almacenamiento y respaldo.
6. Interrupción del flujo de trabajo debido a limitaciones de almacenamiento y rendimiento del equipo durante el procesamiento de archivos RAW (.CR2…
7. Apoyo a Luis con la creación y ajustes del archivo editable de una ficha técnica.
8. Edición y revelado de 54 fotografías de la selección de bebidas.
9. Creación y publicación de una historia para el perfil de Instagram de Brasa & Piedra.'),
('90442ec3-e2dc-42bf-bb2b-4d4cba2ec872'::uuid,'2026-07-22'::date,'Marketing','brazo-y-piedra',NULL,'2026-07-24 09:21:52+00'::timestamptz,'1. Jornada de trabajo en Brasa & Piedra para la recopilación de contenido fotográfico y audiovisual.
2. Continuación del proceso de edición fotográfica, obteniendo una selección final de 114 fotografías editadas.
3. Realización de la sesión fotográfica de las bebidas de mixología pendientes.
4. Apoyo al equipo de filmmakers durante la grabación de contenido audiovisual.
5. Ajustes y actualización del menú del restaurante.
6. Investigación de referencias audiovisuales para la implementación de contenido en la sección desarrollada con Framer del sitio web del restaurante…
7. Actualización del sitio web mediante la vinculación del nuevo sistema de reservaciones.
8. Desarrollo de la idea creativa y storytelling para la grabación de la primera sección del video promocional de Noches de Música en Vivo.')
) as d(pid, fecha, area, marca, evi, ts, texto)
where not exists (select 1 from mkt_daily_reports x where x.organization_id='00000000-0000-0000-0000-000000000001'
  and x.profile_id = d.pid and x.created_at = d.ts);
