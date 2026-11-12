// Official Subscriptions API. Only new resource-filtered subscriptions are
// created. Existing subscriptions, profiles and security settings are immutable.
// https://www.infobip.com/docs/api/platform/subscriptions-api/subscription/create-subscription
import { sameWhatsAppPhone } from "./infobip-sender.mjs";

export class ReadonlySetupError extends Error {
  constructor(message, code = "RECEIVER_SETUP") { super(message); this.code = code; }
}

const EVENTS = ["INBOUND_MESSAGE", "BUSINESS_APP_MESSAGE_ECHO"];
const PATH = "/subscriptions/1/subscription/WHATSAPP";
const ID = /^[a-zA-Z0-9_-]{1,255}$/;

function exactResource(subscription, sender) {
  return Array.isArray(subscription.resources) && subscription.resources.length === 1
    && sameWhatsAppPhone(subscription.resources[0], sender);
}
function matches(subscription, event, profileId, sender) {
  return exactResource(subscription, sender)
    && subscription.events?.length === 1 && subscription.events[0] === event
    && subscription.profile?.profileId === profileId
    && !subscription.subscriptionGroupId
    && !subscription.criteria?.length && !subscription.users?.length && !subscription.keywords?.length;
}

export async function inspectReadOnlySubscriptions(api, config, sender) {
  if (!config.inProfileId || !config.echoProfileId || !config.authId
      || ![config.inProfileId, config.echoProfileId, config.authId].every(id => ID.test(id))) {
    throw new ReadonlySetupError("Stratos debe terminar la configuración inicial del receptor.", "RECEIVER_NOT_CONFIGURED");
  }
  const profileIds = [config.inProfileId, config.echoProfileId];
  const urls = [config.inUrl, config.echoUrl];
  for (let i = 0; i < profileIds.length; i++) {
    const profile = await api(`/subscriptions/1/profiles/${profileIds[i]}`);
    if (profile?.profileId !== profileIds[i] || profile.webhook?.notifyUrl !== urls[i]
        || profile.security?.authId !== config.authId) {
      throw new ReadonlySetupError("El receptor de esta cuenta Infobip no coincide con el de Stratos. No se cambió ninguna conexión.", "RECEIVER_MISMATCH");
    }
  }
  const subscriptions = [];
  for (let page = 0; ; page++) {
    const result = await api(`${PATH}?${new URLSearchParams({ resource: sender, page: String(page), size: "100" })}`);
    if (!Array.isArray(result.results)) throw new ReadonlySetupError("Infobip no devolvió una lista de suscripciones válida.");
    subscriptions.push(...result.results);
    if (result.results.length < 100 || page + 1 >= result.paging?.totalPages) break;
    if (page >= 4) throw new ReadonlySetupError("Hay demasiadas reglas para este número. Revisa su configuración en Infobip.");
  }
  const existing = EVENTS.map((event, i) => {
    const candidates = subscriptions.filter(s => Array.isArray(s.resources)
      && s.resources.some(resource => sameWhatsAppPhone(resource, sender)) && s.events?.includes(event));
    if (candidates.some(s => !matches(s, event, profileIds[i], sender)) || candidates.length > 1) {
      throw new ReadonlySetupError("Este número ya tiene una recepción específica diferente. Revísala en Infobip antes de continuar; no se reemplazó.", "EXISTING_RECEIVER");
    }
    return candidates[0] ?? null;
  });
  return { existing, profileIds };
}

export async function ensureReadOnlySubscriptions({ api, config, sender, prepareChannel }) {
  if (!/^[1-9][0-9]{7,14}$/.test(sender)) throw new ReadonlySetupError("Número de Infobip inválido.");
  const plan = await inspectReadOnlySubscriptions(api, config, sender);
  // The database locks the canonical number and rejects other organizations,
  // different advisors and protected legacy channels before any provider write.
  const channel = await prepareChannel();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(channel.channel_id)) throw new ReadonlySetupError("No se pudo preparar el canal de esta empresa.");
  const ids = [];
  for (let i = 0; i < EVENTS.length; i++) {
    if (plan.existing[i]) {
      if (!ID.test(plan.existing[i].subscriptionId ?? "")) throw new ReadonlySetupError("Infobip no devolvió un identificador de suscripción válido.");
      ids.push(plan.existing[i].subscriptionId); continue;
    }
    const subscriptionId = `stratos-${i === 0 ? "in" : "echo"}-${channel.channel_id}`;
    const desired = { subscriptionId, name: `Stratos ${i === 0 ? "entrada" : "eco"} ${sender}`,
      events: [EVENTS[i]], resources: [sender], profile: { profileId: plan.profileIds[i] } };
    let createError;
    try { await api(PATH, { method: "POST", body: desired }); }
    catch (error) { createError = error; }
    // Reconcile success, a timeout or a concurrent retry by reading the same ID.
    // Never repeat a blind POST and never PUT/DELETE someone else's rule.
    let saved;
    try { saved = await api(`${PATH}/${subscriptionId}`); }
    catch (error) { throw createError ?? error; }
    if (!matches(saved, EVENTS[i], plan.profileIds[i], sender)) {
      throw new ReadonlySetupError("La regla guardada no coincide con esta conexión. No se habilitó como comprobada.", "SUBSCRIPTION_MISMATCH");
    }
    ids.push(subscriptionId);
  }
  return { channel_id: channel.channel_id, inbound_subscription_id: ids[0], echo_subscription_id: ids[1] };
}
