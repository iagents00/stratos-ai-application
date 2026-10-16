# Refinamiento de flujos y galería

Solicitud del usuario: ordenar el sitio para móvil y PC, reemplazar el celeste del menú de cápsulas por azul casi negro o blanco y añadir motion explicativo adaptado a Stratos AI, siguiendo su referencia de Savio.

## Fuente y comportamiento

- Dos diagramas HTML/CSS/SVG: consulta → Copilot → clientes, pendientes y próximos pasos; actividad registrada → Comando → cartera, equipo y Métricas. Son ilustrativos y están identificados como tales.
- Dos recorridos de 5.6 s, pausa/reanudación y repetición manual. Fuera de pantalla, documento oculto o movimiento reducido detienen las señales. El guard de rendimiento de iPhone permanece intacto.
- Pestaña activa #0A1B2E con texto blanco; seis opciones visibles en 3×2 hasta 700 px. Capturas reales completas, más amplias; los seis activos y su procedencia permanecen intactos.
- La galería mantiene rotación de 2800 ms, teclado, pausas independientes y exploración manual. El hero conserva sus siete frases y reserva dos líneas en móvil.
- Marketing sigue aislado del CRM, login y paquetes nativos. Se mantienen precios, rutas, contactos y configuración por empresa.

## Comprobaciones locales

- 195 pruebas Node; 34 pruebas Rails; 12 comprobaciones PostgreSQL locales: aprobadas.
- Build web y build app: aprobados. Los artefactos nativos no contienen `smk-flow` ni `smk-motion-card`.
- ESLint dirigido: aprobado. Runtime: aprobado; conserva 335 avisos adicionales preexistentes.
- Identidad, tenants, rutas, RPC, catálogo operativo, migraciones, contexto, lenguaje, mapas y referencias documentales: aprobados.
- Detector una vez por archivo cambiado: cero errores. Dos warnings de fuentes comparan con el DESIGN.md global de Rails; Switzer/Inter están documentadas en el boundary de marketing. Avisos de escala y radio se evalúan contra la referencia fijada y el sistema local.

La evidencia visual y funcional se conserva junto a este documento. La revisión independiente se registra por separado en REVIEW.md cuando finaliza; esta validación no equivale a un veredicto ni a una comprobación de producción.
