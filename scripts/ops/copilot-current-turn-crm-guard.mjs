/**
 * Keep unambiguous CRM commands on the current turn and on the CRM route.
 *
 * The interpreter sees recent conversation history and can mistake a new,
 * self-contained CRM command for a correction/completion of an older plan or
 * for a team task. This patch wins only for narrow current-turn signatures;
 * the existing classifier and backend still decide and execute the CRM tool.
 */

export const marker = '// CURRENT_TURN_CRM_ROUTE_GUARD_V2_20260923';

const detector = `function _currentTurnCrmIntent(s){
  const source = String(s || '');
  const norm = source.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  if (!norm) return '';

  // These are personal reminders because the command addresses the assistant
  // in first person. "Recuérdale/avísale a X" deliberately does not match.
  if (/^(?:recuerdame|avisame)\\b/.test(norm)) return 'personal_reminder';

  const phoneSource = source.replace(/\\bQA-\\d{8}-[A-Z0-9-]+\\b/ig, ' ');
  const phones = (phoneSource.match(/\\+?\\d[\\d ().-]{6,}\\d/g) || [])
    .map(value => value.replace(/\\D/g, ''))
    .filter(value => value.length >= 8 && value.length <= 15);
  const createVerb = /\\b(?:registra(?:r|me|lo|la|nos|los|las)?|registre(?:me|lo|la)?|crea(?:r|me|lo|la|nos|los|las)?|agrega(?:r|me|lo|la|nos|los|las)?)\\b/.exec(norm);
  const clientNoun = /\\b(?:cliente|lead)\\b/.exec(norm);
  if (createVerb && clientNoun && createVerb.index < clientNoun.index && phones.length === 1) {
    const between = norm.slice(createVerb.index, clientNoun.index);
    if (!/\\b(?:nota|seguimiento|actividad|tarea|recordatorio|llamada|whatsapp|correo|email|visita|reunion|zoom)\\b/.test(between)) {
      return 'individual_create';
    }
  }

  const signatures = [
    {
      kind: 'next_action',
      marker: /\\bproxima\\s+accion\\b/,
      command: /\\b(?:pon|poner|ponle|define|definir|actualiza|actualizar|cambia|cambiar|programa|programar|agenda|agendar|establece|establecer)\\b[\\s\\S]*\\bproxima\\s+accion\\b/,
    },
    {
      kind: 'stage',
      marker: /\\b(?:contactame\\s+ya|segundo\\s+intento|tercer\\s+intento|rotacion|remarketing\\s+ia|zoom\\s+agendado|reactivar\\s+zoom|zoom\\s+concretado|seguimiento|largo\\s+plazo|aparto|visita\\s+agendada|cierre|postventa)\\b/,
      command: /\\b(?:mueve|mover|pasa|pasar|pasalo|pasala|cambia|cambiar|pon|poner|coloca|colocar|manda|mandar)\\b[\\s\\S]*\\b(?:contactame\\s+ya|segundo\\s+intento|tercer\\s+intento|rotacion|remarketing\\s+ia|zoom\\s+agendado|reactivar\\s+zoom|zoom\\s+concretado|seguimiento|largo\\s+plazo|aparto|visita\\s+agendada|cierre|postventa)\\b/,
    },
    {
      kind: 'zoom',
      marker: /\\bzoom\\b/,
      command: /\\b(?:agenda|agendar|programa|programar|pon|poner|registra|registrar)\\b[\\s\\S]*\\bzoom\\b/,
    },
    {
      kind: 'visit',
      marker: /\\bvisita\\b/,
      command: /\\b(?:agenda|agendar|programa|programar|pon|poner|registra|registrar)\\b[\\s\\S]*\\bvisita\\b/,
    },
    {
      kind: 'case_note',
      marker: /\\b(?:nota|observacion)\\b/,
      command: /\\b(?:agrega|agregar|anade|anadir|pon|poner|deja|dejar|escribe|escribir|registra|registrar|anota|anotar|apunta|apuntar)\\b[\\s\\S]*\\b(?:nota|observacion)\\b[\\s\\S]*\\b(?:expediente|cliente|lead)\\b/,
    },
  ];

  for (const signature of signatures) {
    const markerMatch = signature.marker.exec(norm);
    if (!markerMatch || !signature.command.test(norm)) continue;
    const prefix = norm.slice(0, markerMatch.index);
    // A task/activity/delegation stated before the CRM-looking fragment belongs
    // to the team flow. This keeps "crea una tarea para que X..." untouched.
    if (/\\b(?:tarea|actividad)\\b/.test(prefix)) continue;
    if (/\\b(?:pidele|dile|encargale|delegale|asignale|avisale|recuerdale)\\b/.test(prefix)) continue;
    if (/\\b(?:para|a)\\s+(?:el\\s+|la\\s+)?(?:equipo|asesor|asesora|vendedor|vendedora|responsable)\\b/.test(prefix)) continue;
    return signature.kind;
  }
  return '';
}`;

export function patchCurrentTurnCrmInterpreter(code) {
  if (code.includes(marker)) return code;

  const bulkAnchor = 'const esAltaMasivaConDatos = _looksLikeBulkLeadInput(raw);';
  const baseCondition = 'esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos';
  const conditionCount = code.split(baseCondition).length - 1;
  if (code.split(bulkAnchor).length !== 2 || conditionCount !== 2) {
    throw new Error('Interpreter changed; inspect instead of overwriting.');
  }

  const guardedCondition = `${baseCondition} || intencionCrmTurnoActual`;
  const legacyStart = code.indexOf('// CURRENT_TURN_CRM_ROUTE_GUARD');
  const legacyEnd = legacyStart < 0 ? -1 : code.indexOf(`if (${baseCondition}`, legacyStart);
  if (legacyStart >= 0 && legacyEnd < 0) throw new Error('Existing CRM guard changed; inspect instead of overwriting.');
  const baseCode = legacyStart >= 0 ? code.slice(0, legacyStart) + code.slice(legacyEnd) : code;
  const next = baseCode
    .replace(
      bulkAnchor,
      `${bulkAnchor}\n${marker}\n${detector}\nconst intencionCrmTurnoActual = _currentTurnCrmIntent(raw);`,
    )
    .split(baseCondition)
    .join(guardedCondition);

  // Syntax-check the exact code that would be placed in the n8n Code node.
  new Function('$input', '$', next);
  return next;
}
