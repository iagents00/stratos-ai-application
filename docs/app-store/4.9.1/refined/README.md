# Stratos AI — App Store en tema claro

Seis piezas individuales en el orden de `manifest.json`: CRM, Copilot, notificaciones, Agenda, Intelligence y expediente.

## Entrega

- `screenshots/`: JPG en sRGB, sin transparencia, 1206 × 2622 px.
- `index.html`: galería para revisar la serie completa.
- `sources/`: capturas de la aplicación real en modo de demostración, tema claro y ancho móvil de 402 px, obtenidas desde el commit `3e9cc706`.
- `prompts.json`: instrucciones finales de las composiciones, realizadas individualmente con la herramienta integrada `image_gen`.
- Los originales PNG seleccionados se conservan localmente en `output/app-store-refined/masters/`.

Los fondos usan azules, blancos y verdes de Stratos. La tipografía promocional generada está inspirada en Montserrat. El iPhone, la iluminación y el marco son composiciones con IA; no son fotografías de un dispositivo ni capturas de píxeles intactos. La interfaz está basada en las capturas reales incluidas, con datos ficticios. Se han revisado visualmente el texto principal y los controles representados.

Los dos avisos de Copilot son ejemplos ilustrativos de recordatorios, rotulados como tales. No se envió ninguna notificación real. Se corresponden con las funciones de recordatorios de tareas existentes; Dynamic Island representa el hardware del teléfono, no una Live Activity de Stratos.

## Exportación

`export.mjs` copia los originales a la carpeta local y hace únicamente la conversión técnica a las dimensiones aceptadas por el apartado «iPhone con Dynamic Island (pantalla mediana)» de App Store Connect. Requiere `sharp` disponible en Node.

```sh
node docs/app-store/4.9.1/refined/export.mjs /ruta/a/las/imagenes/generadas
```

La conversión comprueba dimensiones, formato y ausencia de alfa para las seis imágenes. La galería fue revisada en navegador. Estos archivos no modifican la interfaz ni requieren una nueva compilación móvil.
