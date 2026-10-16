# QA del marco translúcido — 16 de octubre de 2026

Una ronda agrupada, sin cambios de implementación. Build local `stratos-v444`, base `e7a9377bef26349eed45bc04120fee345710ef2d`, compilado `2026-10-16T18:10:03.624Z` con el árbol de la rama de refinamiento. Preview aislado en 5303; navegador anónimo con Supabase bloqueado antes de navegar. No se abrió login ni CRM real.

Resultado: aprobado, sin hallazgos materiales.

- Seis imágenes de `/marketing/modules/framed-20261016/` cargan con tamaño natural 1440×1020.
- Las seis pestañas manuales, pausa explícita, avance de 2800 ms sin hover/foco y navegación por teclado conservan su comportamiento.
- Movimiento reducido mantuvo la pestaña CRM durante un ciclo completo, desactivó reproducción automática y permitió selección manual.
- Galería en 1440/390/320: fondo blanco, figura transparente sin radio/sombra adicionales, proporción completa de 1440/1020, contain y ningún recorte del asset.
- Switzer/Inter cargadas y documento sin overflow en las tres vistas.
- Habla/Procesa/Claridad usan las composiciones correctas. Workflow y los dos beneficios visuales mantienen 1440×1020, contain y proporción completa en las tres vistas.
- El marco se aprecia discreto; los textos de la portada conservan legibilidad. La captura interna se reduce proporcionalmente en móvil, sin corte añadido.
- Cero errores de página y HTTP; cero consultas Supabase emitidas.

## Capturas

Galerías para revisión: `desktop-gallery.png` 1120×892, `mobile-gallery.png` 390×1202, `user-320-gallery.png` 320×1202. Usos adicionales: `{desktop,mobile,user-320}-{workflow,benefits}.png`. Estos recortes excluyen la navegación sticky y muestran completos sus componentes.

`QA.json` contiene controles, medidas, paths, dimensiones y hashes. `release.json` identifica el build. La integridad de los píxeles originales de los seis núcleos fue verificada previamente por root en el manifest de los assets; esta QA comprueba su integración y presentación, no vuelve a componerlos.
