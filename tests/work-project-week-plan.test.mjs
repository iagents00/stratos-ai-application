import test from "node:test";
import assert from "node:assert/strict";
import { weekCalendar, weekDraft } from "../supabase/functions/_shared/work-project-week-plan.mjs";

test("the weekly planner uses the user's local day even when UTC is already tomorrow", () => {
  const now = new Date("2026-11-24T03:30:00Z");
  const tijuana = weekCalendar("America/Tijuana", now);
  assert.deepEqual(tijuana.slice(0,3), [
    {day:"2026-11-23",weekday:"lunes"}, {day:"2026-11-24",weekday:"martes"}, {day:"2026-11-25",weekday:"miércoles"},
  ]);
  assert.equal(weekCalendar("Asia/Tokyo", now)[0].day,"2026-11-24");
  assert.throws(() => weekCalendar("Invalid/Timezone", now));
});

test("a weekly draft preserves specific people and times, and keeps ambiguous entries editable", () => {
  const workspace = { people:[{id:"me"},{id:"ana"}], projects:[{id:"pilot"}] };
  const data = { notes:["Confirmar la hora de revisión"], activities:[
    { title:"Revisar propuesta",outcome:"Propuesta revisada",who:"Ana",assignee_id:"ana",project_id:"pilot",
      due_on:"2026-11-24",time:"09:00",criteria:["Verificar alcance"] },
    { title:"Confirmar revisión",outcome:"Registro actualizado",who:"Yo",assignee_id:"me",project_id:"pilot",
      due_on:"2026-11-25",time:"16:00",criteria:["Guardar el resultado"] },
    { title:"Preparar otra tarea",outcome:"Tarea preparada",who:"Luis",assignee_id:"outsider",project_id:"unknown",
      due_on:"2026-02-31",time:"26:05",criteria:[] },
  ] };
  const plan = weekDraft(data,workspace);
  assert.equal(plan.activities[0].assignee_id,"ana");
  assert.equal(plan.activities[0].time,"09:00");
  assert.equal(plan.activities[1].assignee_id,"me");
  assert.equal(plan.activities[1].due_on,"2026-11-25");
  assert.deepEqual(plan.activities[2], {
    title:"Preparar otra tarea",outcome:"Tarea preparada",who:"Luis",assignee_id:"",project_id:"",due_on:"",time:"",requires_time:true,criteria:[],
  });
  assert.equal(plan.notes[0],"Confirmar la hora de revisión");
  assert.throws(() => weekDraft({activities:Array(51).fill(data.activities[0])},workspace));
});
