import { readDescription, blockingReason } from './board-model.mjs';
export function buildCodexPrompt(task, project, tasks) {
 const {notes,checklist}=readDescription(task.descripcion);
 const name=project?.nombre||'Sin proyecto';
 const destination=/amistad/i.test(name)?'Amistad-app12':/stratos|huli/i.test(name)?'stratos-ai-application':/iaos/i.test(name)?'IAOS SEP7':'Elige el proyecto de Codex correspondiente antes de empezar';
 return `Trabaja en el proyecto de Codex: ${destination}.

Tarea de I Space: ${task.titulo}
Referencia: ${task.id || 'borrador sin guardar'}
Proyecto: ${name}
Estado registrado: ${task.estado}

Objetivo y contexto del proyecto:
${project?.descripcion||'Por definir'}

Alcance de esta acción:
${notes||task.titulo}

Criterios de aceptación:
${checklist.map(x=>`- [${x.done?'x':' '}] ${x.text}`).join('\n')||'- Acordar el resultado verificable antes de modificar.'}

Dependencias:
${blockingReason(task,tasks)||'No hay un bloqueo registrado. Verifica los prerrequisitos reales antes de ejecutar.'}

Forma de trabajar:
Lee AGENTS.md y las instrucciones aplicables. Inspecciona el estado real del proyecto, conserva cambios ajenos y trabaja en la fuente oficial. Ejecuta esta acción dentro de su alcance; no conviertas el resto del proyecto en trabajo autorizado. Si depende de trabajo pendiente, verifica esa dependencia y explica el bloqueo antes de avanzar. No inventes resultados, accesos, fechas ni permisos. Respeta las reglas de pruebas, revisión y publicación de ese repositorio.

Entrega para devolver a I Space:
1. Qué hiciste y qué quedó pendiente.
2. Evidencia: archivos, pruebas, PR y enlace live si corresponde.
3. Resultado de cada criterio de aceptación.
4. Estado recomendado: en curso, en revisión o hecha, con su justificación.
5. Siguiente acción independiente, si la detectas.
No declares actualizada la tarjeta de I Space si no tienes una conexión de escritura verificada.`;
}
