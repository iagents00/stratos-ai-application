# QA — Hero flow

23 comprobaciones confirmadas; cero defectos de producto abiertos. Una sola ronda de capturas sobre preview compilado, en 1440×1000, 834×1112, 390×844 y 320×812.

- Red SVG visible, señales CSS con avance medido y texto central legible. Header solo «Stratos AI» y ningún control Pausar/Reanudar/Repetir/Play en la portada.
- Titular y galería avanzan; rotación medida de 2804.1 y 2808.7 ms. El titular conserva su geometría. Los seis estados de galería conservan exactamente la misma altura de panel, sección y documento en los cuatro tamaños: variación 0 px.
- Click y touch seleccionan y continúan; foco de teclado pausa hasta blur. Solo un panel aparece en accesibilidad y la tabulación no entra en paneles inactivos.
- Sin overflow. Seis tabs de al menos 44 px, selección navy/blanco, seis capturas reales 1440×1020 intactas. Fuentes cargadas. CTA, enlaces /login y diagnóstico, menú ESC y anclas correctos.
- Fuera de pantalla se congelan hero/titular y galería. Movimiento reducido muestra exactamente una frase, elimina animaciones y conserva selección manual.

## Límite del navegador automatizado

No se verificó un `document.hidden` real: Chromium mantuvo `false` al enfocar otra pestaña y minimizar la ventana, incluso sin focus emulation. Se verificó por separado el listener **sintético**, sustituyendo temporalmente esa propiedad y lanzando `visibilitychange`; el titular, la galería y el reloj SVG quedaron inmóviles. La propiedad se restauró. No se atribuye esa prueba a un cambio real de visibilidad.

Una aserción inicial de timing asumía un intervalo nuevo después de desplazar hacia una galería que ya era visible. Se sustituyó por la medición de dos cambios reales; no se repitieron capturas ni se cambió código.

Las ocho imágenes y sus hashes están en `QA.json`. Supabase bloqueado antes de navegar, sin login ni CRM real, sin errores de página ni HTTP.
