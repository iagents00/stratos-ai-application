# QA funcional — motion landing

24 comprobaciones confirmadas; cero defectos de producto abiertos. Preview compilado anónimo, con Supabase bloqueado antes de navegar. Sin login ni CRM real.

- Galería: seis opciones manuales, teclado Home/End/flechas, avance automático de 2800 ms sin hover/foco, pausa y movimiento reducido. Seis assets reales 1440 × 1020.
- Flujos: avance CSS medido, pausa y reanudación conservando el tiempo, congelación fuera del viewport, final finito y repetición. Repetir remonta el arte y conserva enlaces y foco. Movimiento reducido desactiva señales y control.
- 1440, 834, 390 y 320 px: fuentes cargadas, seis tabs visibles de 44 px, selección navy/blanco, imagen completa y diagramas dentro de sus límites, sin overflow. Menú móvil ESC y anclas comprobados.
- Navegación pública y destinos de login intactos. Sin errores de página ni respuestas HTTP fallidas en el lote funcional.

## Límite explícito del harness

No se verificó un `document.hidden` auténtico. Chromium mantuvo el valor `false` con otra pestaña en primer plano y con ventana minimizada, incluso desactivando focus emulation. El listener se comprobó de forma **sintética**: se sustituyó temporalmente `document.hidden`, se lanzó `visibilitychange`, se observó congelación exacta del reloj y reanudación, y se restauró la propiedad. No se presenta esa prueba como un cambio real de visibilidad del navegador.

`QA.json` consolida los resultados asentados y enlaza los registros originales. Los fallos iniciales por muestreo prematuro de transición CSS y estado pausado no restaurado fueron corregidos en el harness y se conservaron como evidencia bruta, sin atribuirlos al producto.

Las capturas oficiales de `.impeccable/review/motion-2026-10-16` pertenecen al lote paralelo de validate_tests; este agente no las sobrescribió.
