/**
 * scripts/verificar-rails.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Chequeo de que la configuración de Stratos Rails de verdad LLEGA al motor.
 *
 * Prender, apagar y personalizar es la promesa del panel "Proceso". Si el motor
 * ignorara la config, el panel mentiría en silencio: los switches se moverían y
 * la lista del día seguiría igual. Este script lo prueba de punta a punta.
 *   npm run verificar-rails
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createServer } from "vite";

let fallos = 0;
const ok  = (m) => console.log(`  ✓ ${m}`);
const mal = (m) => { console.error(`  ✗ ${m}`); fallos++; };

const vite = await createServer({ server: { middlewareMode: true }, logLevel: "silent" });
try {
  const { listaDelDia, catalogoDeReglas } = await vite.ssrLoadModule("/src/lib/next-action-engine.js");
  const { fusionarRails, compactarRails, RAILS_DEFAULTS } = await vite.ssrLoadModule("/src/lib/rails-config.js");

  const hace = (d) => new Date(Date.now() - d * 864e5);
  const leads = [
    { id: "1", n: "Fam. Rodríguez", st: "Seguimiento",   hot: true, sc: 92, updatedAt: hace(3) },
    { id: "2", n: "Tony",           st: "Seguimiento",   hot: true, sc: 88, updatedAt: hace(2) },
    { id: "3", n: "Ana",            st: "Zoom Agendado",            sc: 70, updatedAt: hace(1) },
    { id: "4", n: "Beto",           st: "Rotación",                 sc: 40, updatedAt: hace(30) },
  ];

  // 1. Sin configuración se comporta como siempre.
  const base = fusionarRails(null);
  if (base.activo !== false) mal("los defaults no vienen apagados");
  else ok("apagado de fábrica");
  if (base.maxTarjetas !== RAILS_DEFAULTS.maxTarjetas) mal("maxTarjetas por defecto incorrecto");

  // 2. El tope de tarjetas manda.
  const dos = listaDelDia(leads, { config: fusionarRails({ maxTarjetas: 2 }) });
  dos.visibles.length === 2 ? ok("el tope de tarjetas se respeta") : mal(`tope: esperaba 2, dio ${dos.visibles.length}`);

  // 3. El texto propio reemplaza al de fábrica, con las fichas resueltas.
  const conTexto = fusionarRails({
    reglas: { lead_caliente: { razon: "{nombre} está listo — llevas {dias} días sin moverle." } },
  });
  const cal = listaDelDia(leads, { config: conTexto }).visibles.find((a) => a.tipo === "lead_caliente");
  if (!cal) mal("no salió ninguna tarjeta lead_caliente para probar el texto");
  else if (!/está listo — llevas \d+ días/.test(cal.razon)) mal(`el texto propio no llegó: "${cal.razon}"`);
  else if (/\{/.test(cal.razon)) mal(`quedaron fichas sin resolver: "${cal.razon}"`);
  else ok(`texto propio con fichas resueltas: "${cal.razon}"`);

  // 3b. {dias_txt} viene conjugado: "1 día", no "1 días".
  const unDia = [{ id: "9", n: "Uno", st: "Seguimiento", hot: true, sc: 90, updatedAt: hace(1) }];
  const conj = listaDelDia(unDia, {
    config: fusionarRails({ reglas: { lead_caliente: { razon: "llevas {dias_txt} sin moverle" } } }),
  }).visibles[0];
  conj?.razon === "llevas 1 día sin moverle"
    ? ok('{dias_txt} conjuga en singular')
    : mal(`{dias_txt} no conjugó: "${conj?.razon}"`);

  // 4. Apagar una regla la saca del día.
  const apagada = listaDelDia(leads, { config: fusionarRails({ reglas: { lead_caliente: { activa: false } } }) });
  apagada.visibles.some((a) => a.tipo === "lead_caliente")
    ? mal("la regla apagada siguió apareciendo")
    : ok("apagar una regla la saca de la lista");

  // 5. El peso reordena.
  const pesada = listaDelDia(leads, { config: fusionarRails({ reglas: { reactivar: { peso: 100 } } }) });
  pesada.visibles[0]?.tipo === "reactivar"
    ? ok("subirle el peso a una regla la pone primero")
    : mal(`el peso no reordenó: primero salió "${pesada.visibles[0]?.tipo}"`);

  // 5b. Quitar la cubeta del orden no debe cambiar el orden de fábrica.
  //     Las cubetas siempre fueron rangos de peso con otro nombre; si alguien
  //     retoca un peso y rompe esa correspondencia, esto lo caza.
  const ORDEN = { prioritario: 0, intermedio: 1, reactivar: 2 };
  const cat = catalogoDeReglas().slice().sort((a, b) => b.peso - a.peso);
  const cubetasEnOrden = cat.map((r) => ORDEN[r.cubeta]);
  cubetasEnOrden.every((v, i) => i === 0 || v >= cubetasEnOrden[i - 1])
    ? ok("ordenar solo por peso conserva el orden de las cubetas")
    : mal(`los pesos ya no respetan el orden de cubetas: ${cat.map((r) => `${r.tipo}(${r.peso}/${r.cubeta})`).join(" ")}`);

  // 5c. El botón grande de la tarjeta tiene que abrir el canal que dice.
  //     Decía "Escribir" y el href era `tel:` siempre: en las tarjetas de
  //     WhatsApp abría el marcador. Y wa.me EXIGE código de país — sin él el
  //     chat sale vacío y el asesor cree que el cliente no le contesta.
  const { hrefDelCanal, digitosWhatsApp } = await vite.ssrLoadModule("/src/lib/telefono.js");
  const wa = hrefDelCanal("whatsapp", "998 123 4567", "Confirma asistencia");
  const tel = hrefDelCanal("llamada", "+52 998 123 4567");
  if (!wa?.href.startsWith("https://wa.me/")) mal(`la tarjeta de WhatsApp no abre WhatsApp: ${wa?.href}`);
  else if (!wa.externo) mal("el enlace de WhatsApp debería abrirse en otra pestaña");
  else if (!/text=/.test(wa.href)) mal("el enlace de WhatsApp no lleva la instrucción del día");
  else ok(`la tarjeta de WhatsApp abre WhatsApp: ${wa.href.split("?")[0]}`);
  tel?.href === "tel:+529981234567" && tel.externo === false
    ? ok("la tarjeta de llamada abre el marcador")
    : mal(`el enlace de llamada quedó mal: ${JSON.stringify(tel)}`);
  digitosWhatsApp("9981234567") === "19981234567"
    ? ok("10 dígitos sin lada se asumen de Estados Unidos")
    : mal(`10 dígitos sin lada: ${digitosWhatsApp("9981234567")}`);
  digitosWhatsApp("+52 998 123 4567") === "529981234567"
    ? ok("una lada explícita se respeta")
    : mal(`lada explícita: ${digitosWhatsApp("+52 998 123 4567")}`);
  digitosWhatsApp("") === "" && hrefDelCanal("llamada", null) === null
    ? ok("sin teléfono no se pinta el botón")
    : mal("sin teléfono debería devolver vacío/null");

  // 5d. "Mover" tiene que agendar de verdad. Antes solo hacía desaparecer la
  //     tarjeta: ni fecha, ni compromiso, ni rastro — el agujero más grande en un
  //     sistema cuya premisa es que ningún cliente se cae.
  const { fechaParaMover } = await vite.ssrLoadModule("/src/lib/agenda.js");
  const lunes = new Date(2026, 7, 23, 16, 47, 12);   // domingo 23-ago-2026, 4:47 pm
  const m3 = fechaParaMover(3, lunes);
  m3.local === "2026-08-26 09:00"
    ? ok(`mover 3 días cae en ${m3.local}`)
    : mal(`mover 3 días dio ${m3.local}, esperaba 2026-08-26 09:00`);
  new Date(m3.iso).getHours() === 9
    ? ok("siempre a las 9, no a la hora en que se tocó el botón")
    : mal(`la hora quedó en ${new Date(m3.iso).getHours()}`);
  fechaParaMover(1, lunes).local === "2026-08-24 09:00" &&
  fechaParaMover(7, lunes).local === "2026-08-30 09:00"
    ? ok("mañana y la próxima semana caen donde deben")
    : mal(`mañana=${fechaParaMover(1, lunes).local} semana=${fechaParaMover(7, lunes).local}`);
  // Cruce de mes: el 30 de noviembre + 3 días es diciembre, no el 33 de noviembre.
  fechaParaMover(3, new Date(2026, 10, 30, 10)).local === "2026-12-03 09:00"
    ? ok("cruzar de mes no rompe la fecha")
    : mal(`cruce de mes: ${fechaParaMover(3, new Date(2026, 10, 30, 10)).local}`);

  // 6. La red de seguridad no se puede apagar desde el panel.
  const fija = catalogoDeReglas().find((r) => r.tipo === "definir_paso");
  fija?.fija === true ? ok("definir_paso está marcada como no apagable") : mal("definir_paso se podría apagar");

  // 7. Solo se guarda lo que difiere del default.
  const compacta = compactarRails(fusionarRails({ activo: true }));
  Object.keys(compacta).join(",") === "activo"
    ? ok("guardar no copia la configuración de fábrica entera")
    : mal(`compactar guardó de más: ${JSON.stringify(compacta)}`);

  // 8. Basura guardada no rompe nada.
  for (const basura of [null, "texto", 42, { maxTarjetas: 9999 }, { reglas: "nel" }, { reglas: { fantasma: {} } }]) {
    try {
      const c = fusionarRails(basura);
      if (!c.reglas || typeof c.maxTarjetas !== "number" || c.maxTarjetas < 1) throw new Error("incompleta");
      listaDelDia(leads, { config: c });
    } catch (e) { mal(`fusionarRails(${JSON.stringify(basura)}) reventó: ${e.message}`); }
  }
  ok("una configuración corrupta no rompe la lista del día");
} finally {
  await vite.close();
}

if (fallos) { console.error(`\n  ${fallos} fallo(s) en la configuración de Rails.`); process.exit(1); }
console.log("\n  La configuración de Rails llega al motor: prender, apagar y personalizar funcionan.");
