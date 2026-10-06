# Kanban de I Space

## Alcance e integración

Superficie operativa de proyectos y tareas dentro de Stratos. Hereda su navegación, tipografía y sesión; no redefine la identidad global. `features.projectKanban` en `src/clients/i-space/config.js` selecciona `ISpaceBoard` en las vistas del módulo de proyectos de `src/app/App.jsx`, conservando la comprobación de acceso al módulo. El acceso a Copilot también depende de su permiso existente.

Ofrece Kanban, Proyectos y Revisión semanal. Es una adaptación práctica de Kanban y algunos hábitos de Scaling Up; no implementa el método completo. No incorpora tablas, columnas ni migraciones nuevas.

## Diseño e interacción

`src/app/views/ISpaceBoard.css` mantiene las variables locales `--is-bg`, `--is-card`, `--is-ink`, `--is-muted`, `--is-line`, `--is-accent`, `--is-on-accent` y `--is-danger`. El componente elige claro u oscuro a partir de `T.bg` y declara `color-scheme` para los controles nativos. El acento verde identifica acciones y foco; los bloqueos también se explican con texto.

El tablero conserva cinco columnas y desplazamiento horizontal. En escritorio cada columna mide al menos 235 px; por debajo de 700 px usa columnas de al menos 265 px, con ajuste de desplazamiento por columna. Formularios, proyectos y revisión pasan a una columna. Cada columna muestra inicialmente hasta cinco tarjetas y permite expandir el resto.

Las tarjetas se mueven arrastrando o mediante un selector nativo de estado. El título abre el editor y dirige el foco al primer campo. Los controles tienen etiquetas, las banderas exponen su estado con `aria-pressed`, los errores usan `role="alert"` y las confirmaciones `role="status"`. Se conserva el foco visible. Mantener estas alternativas al modificar la interacción.

## Datos y reglas de la interfaz

- **Proyectos:** nombre, descripción de resultado/métrica/contexto, fecha objetivo, estado y enlace. La prioridad trimestral se guarda como `Prioridad trimestral: Sí` en `descripcion`; el editor y la vista separan esa marca del texto descriptivo. El avance cuenta tareas hechas sobre el total del proyecto.
- **Tareas:** responsable, proyecto, fecha/hora local, estado, prioridad, una dependencia y enlace de evidencia. “Por asignar” no invita personas ni concede permisos. Los enlaces admitidos son HTTP y HTTPS.
- **Checklist y notas:** viven en `mkt_tasks.descripcion` como texto plano. Los pasos usan Markdown `- [ ]` y `- [x]`; el bloqueo manual usa una línea `Bloqueo: …`. El resto se conserva como notas, con normalización de espacios al guardar. No hay un esquema adicional de checklist.
- **Foco semanal:** corresponde a `prioridad` alta o urgente en tareas no hechas. Activar la bandera asigna alta; desactivarla asigna media. No representa una semana fechada ni un historial semanal.
- **Bloqueadas:** columna derivada de un bloqueo manual o una dependencia pendiente/no disponible; no es un estado persistido seleccionable. Las tareas hechas quedan fuera del cómputo de bloqueos. Al resolver la causa, la tarea reaparece en la columna de su estado guardado.
- **Capacidad:** WIP sugerido de tres tareas en curso, contando la columna derivada. Superarlo muestra una advertencia y no impide guardar. Los límites recomendados para foco y prioridades trimestrales también son orientativos.

`board-model.mjs` valida títulos, ciclos de dependencias, avance con bloqueos y checklist incompleto al cerrar. Permite registrar un bloqueo en una tarea ya en curso sin cambiar su estado. Estas validaciones de interfaz no constituyen restricciones globales de las tablas. El motor de proyectos nuevo también las controla en su RPC transaccional; otros clientes conservan sus reglas existentes. Véase [Copilot de proyectos](i-space-copilot.md).

“Preparar revisión” abre un borrador de tarea con checklist para resultados, evidencia, bloqueos, responsables y siguiente foco. Requiere guardar; no programa revisiones automáticas.

## Persistencia, errores y aislamiento

`useBoard.js` consulta proyectos y tareas no eliminados, perfiles y marcas activas con predicados explícitos `organization_id` tomados de la sesión. Pagina las tareas en bloques de 500. Las inserciones incorporan organización y autor; las actualizaciones filtran por registro, organización, `updated_at` previo y ausencia de borrado. Estos predicados complementan las políticas RLS existentes; el indicador visual “privado” y la bandera de funcionalidad no son mecanismos de autorización.

Durante el guardado se bloquean envíos simultáneos de esta instancia y se deshabilita el formulario. Una escritura confirmada muestra “Guardado en I Space”, recarga los datos y cierra el editor. Los errores conservan el borrador. La comparación de `updated_at` evita sobrescribir silenciosamente un registro modificado desde otra sesión; el mensaje pide copiar el borrador, actualizar y reabrir el editor. No hay fusión automática ni sincronización en tiempo real. Si falla la recarga posterior a una escritura, puede aparecer un error de carga aunque la escritura ya se haya confirmado.

## Verificación y mantenimiento

El cierre de esta revisión se limita a las correcciones de esta superficie. Se revisaron capturas de escritorio y móvil; no se adjuntan datos privados ni capturas al repositorio. `npm run check:project` y las seis pruebas de `node --test tests/i-space-board.test.mjs` pasan. Las pruebas cubren serialización del checklist, dependencias y bloqueos, ciclos, cierre/progreso, foco/enlaces y registro de bloqueo sin avance.

Esta evidencia no verifica todavía un despliegue activo ni sustituye pruebas de integración de RLS y concurrencia entre sesiones. Mantener las reglas en `board-model.mjs`, el acceso a datos en `useBoard.js` y los estilos acotados a la superficie al ampliar el tablero.
