-- ⚠️ NUMERACIÓN: se aplicó a Supabase con el nombre `183_registro_real_desde_la_hoja_2026_2025`.
-- El archivo va con 188 porque 183 ya estaba tomado por otra sesión que trabajaba en
-- paralelo (181, 182 y 183 quedaron duplicados entre las dos ramas). Conviene ponerse
-- de acuerdo en cómo se numeran las migraciones cuando hay dos sesiones a la vez.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 183 — El registro de Alex, cargado DE VERDAD desde su hoja (2026 y 2025)
--
-- Hasta hoy las 21 propiedades de 2026 estaban en Stratos con el nombre, la
-- fecha y el estatus... y NADA MÁS: crudos, video, reel, story, ficha e info
-- estaban VACÍOS en LAS 21. Por eso Alex seguía abriendo su Sheet: acá veía
-- dónde iba cada video, pero no podía trabajar.
--
-- Esto trae los ENLACES REALES —sacados de los hipervínculos del archivo, no
-- del texto que se ve— y suma la hoja 2025 (13 propiedades publicadas).
-- Las hojas 2024, 2023 y Reventas están VACÍAS (solo encabezados): por eso
-- «hasta 2025» cubre todo lo que existe.
--
-- También corrige 7 estatus que no coincidían con la hoja (3 «Aprobado» que
-- figuraban como publicadas y 4 «esperando aprobación» que figuraban en edición)
-- y deja las ubicaciones con la ortografía exacta de la hoja, para que el
-- desplegable no muestre la misma plaza escrita de dos formas.
--
-- Se agrega `area` a la bitácora porque el «Puesto/Área» es un campo DEL
-- FORMULARIO, no algo que se deduzca del rol: reportan 3 áreas distintas y
-- deducirlo mandaba a Emmanuel Ortiz y a Carolina Curiel a «Administración».
--
-- Fuente: docs.google.com/spreadsheets/d/1olJpeRM4A4MMeou0g5kAblchQdjvyTIB8ysqsaztKPo
-- Solo AGREGA y CORRIGE datos de Duke; no borra nada. Antes de esto, los seis
-- campos de enlace estaban en null en las 21 filas.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.mkt_daily_reports add column if not exists area text;

with d(nombre,fecha_rodaje,fecha_publicacion,crudos_url,video_url,ig_url,story_url,cine_url,ficha_url,info_url,locacion,precio,tipo,etapa) as (values
('Shark Tower',null::date,'2026-04-25'::date,null,'https://drive.google.com/file/d/1Bw0yCsQVLYoNCEBpfYA1SZnf8SIvTUhU/view?usp=drive_link','https://www.instagram.com/reel/DXkCN3YkRMN/',null,null,null,null,'Puerto Cancun',null,'Depto','publicada'),
('Casa Lago','2026-04-21'::date,'2026-05-17'::date,'https://drive.google.com/drive/folders/1rO8Obek60c8rNb5flwG_k779UogBfyTo?usp=drive_link','https://drive.google.com/file/d/1m0p6ar0B0OVeySK0d_aZU3Fz_Cd0RS3F/view?usp=drive_link','https://www.instagram.com/reel/DYdLaXOTTfK/','https://drive.google.com/file/d/1tSeMMPD952c1RL6QEF80IqOVuUT1jNOf/view?usp=drive_link',null,'https://drive.google.com/file/d/18geT7a1DV4SzFfs7E-heDKhWdIbIb1Ih/view?usp=drive_link',null,'Cancun','$22.88 MDP','Casa - Villa','publicada'),
('Terreno TCC','2026-05-04'::date,'2026-05-20'::date,null,null,'https://www.instagram.com/reel/DYlNyE7xzHH/',null,null,null,'https://drive.google.com/drive/folders/1-TkBKBNRMEugUuAGO8pc3XueYIDIFsQ4','Tulum',null,'Terreno','publicada'),
('Porto Fino','2026-04-30'::date,'2026-05-24'::date,'https://drive.google.com/drive/folders/1nrZV7FyI8smkfyJLWtketG059W87Ud9e?usp=drive_link','https://drive.google.com/file/d/18UVx9fujv8XpnZreTHs3uLIl0gP-WZtI/view?usp=sharing','https://www.instagram.com/p/DYvUDVozbbN/',null,null,'https://drive.google.com/file/d/1E-QFRCM_G1g1xUcsFiEEcku7a4S0FHKs/view?usp=drive_link',null,'Cancun','$39.6 MDP','Depto','publicada'),
('Gobernador Show Room','2026-05-05'::date,'2026-06-09'::date,'https://drive.google.com/drive/folders/1jULpOM96LBHTs68P6F1ymrmwwJfe3OTC?usp=drive_link','https://drive.google.com/file/d/1DtFDSFW1psAxSaFki1v4iPvoGRHPV0CS/view?usp=drive_link','https://www.instagram.com/reel/DZYSh_3RPuu/?igsh=MTk4dmZlc3I4eHl3eg%3D%3D',null,null,'https://drive.google.com/file/d/1Ba-m6_UmFYai_6jSsN0Qvq3tX3K3QNiZ/view?usp=drive_link','https://drive.google.com/drive/folders/145H_xX8xjJnqEz3RKQHwjEQFVk5oyXTU','PDC','$2.5 MDP','Depto','publicada'),
('Casa 392 m2','2026-04-25'::date,'2026-06-17'::date,'https://drive.google.com/drive/folders/1bxWjz6b53FLAXOLSDPWjMYg3Chh_F_LC?usp=drive_link','https://drive.google.com/file/d/1b75PrxhkCBUEpP2qDQFs7oifymLBG9yx/view?usp=drive_link','https://www.instagram.com/reel/DZst46aTEBX/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==',null,null,'https://drive.google.com/file/d/1HqOGguakr-2CeWGZBDZ72aJPHyFEB3nt/view?usp=drive_link',null,'Cancun','$14 MDP','Casa - Villa','publicada'),
('SLS PentHouse Puerto','2026-06-19'::date,'2026-06-27'::date,'https://drive.google.com/drive/folders/1E2SbQqCZoajOtoCTGvN6W4XoZojEMdQN','https://drive.google.com/file/d/1PYLk7YhRAL1658IsdsMBlP4ycWE02ZlO/view?usp=drive_link','https://www.instagram.com/p/DaGf7mTzIaw/',null,null,'https://drive.google.com/file/d/11rCn6jOLfHbyWtYlURl3Ssr5rh4E1X4N/view?usp=drive_link',null,'Puerto Cancun','$102 MDP','Depto','publicada'),
('Casa Jazmines 25','2026-04-22'::date,null::date,'https://drive.google.com/drive/folders/12kWAQlOFl7uY5ZtNoRY4zOHdL2VuPICO?usp=drive_link','https://drive.google.com/file/d/1KQ9UQsIR0aYuB_zNEpEHWY19G7iaIq_t/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1dbpmBGwLdLhPufFOBOdgaJKW07mE1cWj/view?usp=drive_link',null,'Cancun','$15.1 MDP','Casa - Villa','esperando_voz'),
('Casa Flamboyanes 5','2026-04-23'::date,null::date,'https://drive.google.com/drive/folders/1uBVeEY0SCWxTbN1ZncYeVBRJRpAw2VGQ?usp=drive_link','https://drive.google.com/file/d/1Vf05btNCZs_u5J_V_PJ3gqRdi37bQmIc/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1H3ZiMD25fd9jjTouaO6kBdflA3T0aHSL/view?usp=drive_link',null,'Cancun','$13.1 MDP','Casa - Villa','esperando_voz'),
('Casa 728.65 m2','2026-04-24'::date,null::date,'https://drive.google.com/drive/folders/19oAqPB2p61KLZjM1x2puqhWzeX4EDAvW?usp=drive_link','https://drive.google.com/file/d/11A4hVDcnefj_XbGKm7qNUR6_JBJoBOvr/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1E2H5eYkN4iDaca5L2GNM_LuZHIScibYx/view?usp=drive_link',null,'Cancun','$19 MDP','Casa - Villa','esperando_voz'),
('Casa BANANA','2026-04-26'::date,null::date,'https://drive.google.com/drive/folders/1GFJHb_oEAQanZrMbIQnGKNhSskjUbaLD?usp=drive_link','https://drive.google.com/file/d/1rvQxQc1SVMR0ZnVQIf8KG5r5DI85HTC6/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1X9vy_7HsZDbVojb1Hj2lnb-DIjNdEgP4/view?usp=drive_link',null,'Tulum','$11.44 MDP','Casa - Villa','lista'),
('CASA Cielo Azul','2026-04-27'::date,null::date,'https://drive.google.com/drive/folders/1rFqrLAzkuKjOQdpeVzn2LXE8g-fNosoi?usp=drive_link','https://drive.google.com/file/d/1Io9L7MzxkeqHw4e2OCwLzpr2EolZ1uwe/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1PNsASPFtc2U6Hj1jFVY54PhIhlmSdYOh/view?usp=drive_link',null,'Tulum','$17.51 MDP','Casa - Villa','lista'),
('Casa Kokoon','2026-04-28'::date,null::date,'https://drive.google.com/drive/folders/1XedxLSRnd8AtISKJO1npYm8pwQEajn1l?usp=drive_link','https://drive.google.com/file/d/1HIJIJRxo_G8ywg4zbyCDvD9JWKEATzgj/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/12oGyDcCcCjKMp3_Ws7Q3w_HAic__uSqU/view?usp=drive_link','https://drive.google.com/drive/folders/17bhjVdSxbh8tWgY5n7QRp4oF16U-2Nyg','Tulum','$ 7.02 MDP','Casa - Villa','esperando_aprobacion'),
('Azulik','2026-04-29'::date,null::date,'https://drive.google.com/drive/folders/1xruMl7Imj9vT6N2jH6GHyPCvzDQrDuPA?usp=drive_link','https://drive.google.com/file/d/186Umr4dGAi0ERZu09FjBKJFrIhAQQK6i/view?usp=drive_link',null,'https://drive.google.com/file/d/1lZDqMaQKNaUTe1YFJTnU8IN4Vp44b8HY/view?usp=drive_link',null,'https://drive.google.com/file/d/1OttGrW2kBSObpsAmN286JuCYiACZdh-k/view?usp=drive_link','https://drive.google.com/drive/folders/1w5kCoDaOcC5l4O00fSB-v1KM2w1l8wnZ','Tulum','Precio Reservado','Casa - Villa','esperando_aprobacion'),
('Casa TCC','2026-05-01'::date,null::date,'https://drive.google.com/drive/folders/1PhAXqYT83WOkgdZuqUYD-IThpMM8S3Wi?usp=drive_link','https://drive.google.com/file/d/16ih2Do9xoRhZZaUgW0b31LKM2bgZss6T/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/134dRH3aFu0vT4TRWr1DfW3z_dQX8OWb5/view?usp=drive_link',null,'Tulum','$16.7 MDP','Casa - Villa','esperando_aprobacion'),
('Casa Abaton','2026-05-02'::date,null::date,'https://drive.google.com/drive/folders/1iOAFv4ZKxd3dEzZqeYQ8pSwl6nLrimHZ?usp=drive_link','https://drive.google.com/file/d/1XeIrwu-_ALmLaaUwUWmT7VIXNFfs7Ybn/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1c9jTUioCAM2isUu8aOBfCCGMQzoNQcr6/view?usp=drive_link','https://drive.google.com/drive/folders/1-HWOXs9KH7S0Jqik2r0mSvY9YUD6tol9','Tulum','$29.56 MDP','Casa - Villa','esperando_aprobacion'),
('Villa Candela','2026-05-03'::date,null::date,'https://drive.google.com/drive/folders/1h4V6wl291aUQbHVtgqHNcMfA3IhZItdY?usp=drive_link','https://drive.google.com/file/d/1PYg033FlrE_PNTvHaG-GUhQ4wPxOB8VT/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1QvCMyCqQruJDksMaSGwwx0cefigvVSk1/view?usp=drive_link','https://drive.google.com/drive/folders/1sCvUepE3ISwPzKX5hjilEarZUXfq_l8i','Tulum','$22.88 MDP','Casa - Villa','lista'),
('Viceroy Show Room','2026-05-26'::date,'2026-07-28'::date,'https://drive.google.com/drive/folders/1q3YwmYldLpfGMYXBbn9XMAucS4-8Of5-?usp=drive_link','https://drive.google.com/file/d/1utwdC6IsDxn9_O2pL3Pl0tHBXPFbi9NS/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1wM7hoQgBmQJowk1c5O-kuMgrhgD2A1WD/view?usp=drive_link','https://drive.google.com/drive/folders/1q-KLz2OL_IC_hnAuIXKZ__UDr7G-7Rs8?usp=drive_link','PDC','6.8MDP','Depto','lista'),
('Mondrian Resident','2026-07-03'::date,'2026-07-11'::date,'https://drive.google.com/drive/folders/10cpUhNNdKvPPU0u4l20aCk2zqwXUcA9R','https://drive.google.com/file/d/1GU5zSicNHJ3us5488sLwlS7oKa7Crwl_/view?usp=drive_link','https://www.instagram.com/reel/DaqThBXRoVN/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==','https://drive.google.com/file/d/1WOXXa6Nu4nRlNsbU5Gt23SlljiH5vwmV/view?usp=drive_link',null,'https://drive.google.com/file/d/1lrILHEWK3W8QNg7nXGrz6OT0atB_ub6P/view?usp=drive_link','https://drive.google.com/drive/folders/1WlvQyMELCEfw1Zzee9srF5cOpxnisihN?usp=drive_link','Cancun','$10.35MDP','Depto','publicada'),
('Yalku Villa Grieta','2026-07-16'::date,null::date,'https://drive.google.com/drive/folders/1ROYDevonojNyeORur7S-EB13ZJloHlwF?usp=drive_link','https://drive.google.com/file/d/1js3PExs29ZYhEllt8juTnOspWhIU3csG/view?usp=drive_link',null,null,null,'https://drive.google.com/file/d/1aTDcJaeoJ-SCYypRvd6efGPR-SZSCTto/view?usp=drive_link','https://drive.google.com/drive/folders/17AGe9pTVf0HfOGXxl3yZnL0owEMRuih9','Tulum','$2.1M USD','Casa - Villa','esperando_voz'),
('Amayal Aldea Zama','2026-07-16'::date,'2026-07-25'::date,'https://drive.google.com/drive/folders/1uGBs6aEDSk-UNycOJcyQ5Pec43qFGkX0?usp=drive_link','https://drive.google.com/file/d/10_x6a8pKXLyYN1rLjzbBp6jJpxeXf2Hq/view?usp=drive_link','https://www.instagram.com/reel/DbN-wLJh6u5/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==',null,null,'https://drive.google.com/file/d/1dCZd2EFgU0LkHgQktOa0KGLK1O4CQFap/view?usp=drive_link','https://drive.google.com/drive/folders/1r4Ultd1Ak_DDVi5XQPk1AHrz4bkQ4_Ys','Tulum','$27.5 MDP','Casa - Villa','publicada')
)
update mkt_pipeline_items p set
  fecha_rodaje=d.fecha_rodaje, fecha_publicacion=d.fecha_publicacion,
  crudos_url=d.crudos_url, video_url=d.video_url, ig_url=d.ig_url, story_url=d.story_url,
  cine_url=d.cine_url, ficha_url=d.ficha_url, info_url=d.info_url,
  locacion=d.locacion, precio=d.precio, tipo=d.tipo, etapa=d.etapa, updated_at=now()
from d
where p.organization_id='00000000-0000-0000-0000-000000000001' and p.deleted_at is null and p.nombre=d.nombre;

with d(nombre,fecha_rodaje,fecha_publicacion,crudos_url,video_url,ig_url,story_url,cine_url,ficha_url,info_url,locacion,precio,tipo,etapa,orden) as (values
('Lighthouse Florida',null::date,'2025-12-12'::date,null,null,'https://www.instagram.com/reel/DSLU_mKDwa_/?igsh=MWJ2eGZ0eDNzb2dsbw==',null,null,null,null,'Miami','$10.2M USD','Casa - Villa','publicada',100),
('Villa Coconut',null::date,'2025-12-05'::date,null,null,'https://www.instagram.com/reel/DR5NLvMj-SS/?igsh=czd1eGt4MWR3Y3lr',null,null,null,null,'Miami','$24.9M USD','Casa - Villa','publicada',101),
('Luna Azul',null::date,'2025-11-27'::date,null,null,'https://www.instagram.com/reel/DRk2qZij3El/?igsh=MWxrb3drczExdmVycw==',null,null,null,null,'Puerto Avenuras','$988K USD','Depto','publicada',102),
('Villa Miroir Luxe',null::date,'2025-11-21'::date,null,null,'https://www.instagram.com/reel/DRVCTyKD-Ac/?igsh=dG53OHVwcjh0eTE=',null,null,null,null,'Miami','$8.236M USD','Casa - Villa','publicada',103),
('Isla Dorada Cancun',null::date,'2025-11-15'::date,null,null,'https://www.instagram.com/reel/DRFiLUVjxZB/?igsh=MTY0dWM0eGd2Mm1wcg==',null,null,null,null,'Cancun','$3.490M USD','Casa - Villa','publicada',104),
('Ambre y Epices Hotel',null::date,'2025-11-06'::date,null,null,'https://www.instagram.com/reel/DQuz-bvD7V6/?igsh=MTltYXNvOHV4ZnhrbQ==',null,null,null,null,'Tulum','$2.8M USD','Hotel','publicada',105),
('Casa Luxury Miami',null::date,'2025-10-31'::date,null,null,'https://www.instagram.com/reel/DQfE7wKj-rm/?igsh=MWt0c2t1amduZjQ3Mw==',null,null,null,null,'Miami','7.950M USD','Casa - Villa','publicada',106),
('Club Real Playacar',null::date,'2025-10-23'::date,null,null,'https://www.instagram.com/reel/DQfE7wKj-rm/?igsh=MWt0c2t1amduZjQ3Mw==',null,null,null,null,'PDC','$24MILL MXN','Casa - Villa','publicada',107),
('Casa Tropical Tulum',null::date,'2025-10-09'::date,null,null,'https://www.instagram.com/reel/DPmm2vxD9Cv/?igsh=MXUweHlhdThid21tNw==',null,null,null,null,'Tulum','$3.300M USD','Casa - Villa','publicada',108),
('Serenity',null::date,'2015-10-04'::date,null,null,'https://www.instagram.com/reel/DPZ_79ajQGe/?igsh=cHFiOGZ1aGxjM3Rj',null,null,null,null,'Puerto Avenuras','$2.5M USD','Casa - Villa','publicada',109),
('Casa Tuburon',null::date,'2025-10-16'::date,null,null,'https://www.instagram.com/reel/DP4yEutD9_4/?igsh=MWNmMW56czFiODd2eg==',null,null,null,null,'Puerto Morelos','$3.7M USD','Casa - Villa','publicada',110),
('P.H Miami',null::date,'2025-10-02'::date,null,null,'https://www.instagram.com/reel/DPUXOsRj6Fx/?igsh=MWE0Zmlka3V6dHlnZw==',null,null,null,null,'Miami','$3.7M USD','Depto','publicada',111),
('P.H Puerto Cancun',null::date,'2025-09-23'::date,null,null,'https://www.instagram.com/reel/DO9nn5vD8DV/?igsh=MTdwNHI1aXY0dnBlZw==',null,null,null,null,'Puerto Cancun','$2M USD','Depto','publicada',112)
)
insert into mkt_pipeline_items (organization_id,brand_id,nombre,fecha_rodaje,fecha_publicacion,crudos_url,video_url,ig_url,story_url,cine_url,ficha_url,info_url,locacion,precio,tipo,etapa,orden)
select '00000000-0000-0000-0000-000000000001', (select id from mkt_brands where organization_id='00000000-0000-0000-0000-000000000001' and slug='duke-del-caribe' limit 1),
       d.nombre,d.fecha_rodaje,d.fecha_publicacion,d.crudos_url,d.video_url,d.ig_url,d.story_url,d.cine_url,d.ficha_url,d.info_url,d.locacion,d.precio,d.tipo,d.etapa,d.orden
from d
where not exists (select 1 from mkt_pipeline_items x
  where x.organization_id='00000000-0000-0000-0000-000000000001' and x.nombre=d.nombre and x.deleted_at is null);
