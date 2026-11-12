import test from "node:test";
import assert from "node:assert/strict";
import { ensureReadOnlySubscriptions, inspectReadOnlySubscriptions } from "../supabase/functions/whatsapp-admin/infobip-readonly-setup.mjs";

const sender = "5218183963030";
const channelId = "30000000-0000-0000-0000-000000000099";
const config = { inProfileId: "trusted-in", echoProfileId: "trusted-echo", authId: "trusted-auth",
  inUrl: "https://receiver.example/in", echoUrl: "https://receiver.example/echo" };
function provider({ records = [], brokenProfile = false, uncertainPost = false } = {}) {
  const stored = [...records], requests = [];
  const api = async (path, options = {}) => {
    requests.push({ path, ...options });
    if (path.startsWith("/subscriptions/1/profiles/")) {
      const id = path.split("/").pop();
      return { profileId: id, security: { authId: config.authId }, webhook: {
        notifyUrl: brokenProfile ? "https://untrusted.example" : id === config.inProfileId ? config.inUrl : config.echoUrl } };
    }
    if (options.method === "POST") {
      stored.push(options.body);
      if (uncertainPost) throw new Error("Response lost after successful write");
      return { subscriptionId: options.body.subscriptionId };
    }
    if (path.includes("?")) return { results: stored, paging: { totalPages: 1 } };
    const record = stored.find(s => s.subscriptionId === path.split("/").pop());
    if (!record) throw new Error("404");
    return record;
  };
  return { api, stored, requests };
}
const setup = (p, prepareChannel = async () => ({ channel_id: channelId })) => ensureReadOnlySubscriptions({
  api: p.api, config, sender, prepareChannel,
});

test("new enrollment creates only two single-number subscriptions using preconfigured authenticated profiles", async () => {
  const p = provider();
  const result = await setup(p);
  assert.equal(result.channel_id, channelId);
  assert.equal(p.stored.length, 2);
  assert.deepEqual(p.stored.map(s => s.events), [["INBOUND_MESSAGE"], ["BUSINESS_APP_MESSAGE_ECHO"]]);
  assert.ok(p.stored.every(s => s.resources.length === 1 && s.resources[0] === sender));
  assert.ok(p.requests.every(r => !r.method || r.method === "POST"));
  assert.ok(p.requests.filter(r => r.method).every(r => r.path === "/subscriptions/1/subscription/WHATSAPP"));
  assert.ok(p.requests.filter(r => r.path.includes("?")).every(r => new URL(`https://api.example${r.path}`).searchParams.get("resource") === sender));
});

test("retry reconciles existing rules, including success with a lost POST response, without duplicate subscriptions", async () => {
  const p = provider({ uncertainPost: true });
  await setup(p); const writes = p.requests.filter(r => r.method).length;
  await setup(p);
  assert.equal(p.stored.length, 2);
  assert.equal(p.requests.filter(r => r.method).length, writes);
});

test("existing known correct subscriptions are adopted without changing them or unrelated catch-all/Duke rules", async () => {
  const p = provider({ records: [
    { subscriptionId: "legacy-all", events: ["INBOUND_MESSAGE"], resources: [], profile: { profileId: "other" } },
    { subscriptionId: "duke", events: ["INBOUND_MESSAGE"], resources: ["5216861936914"], profile: { profileId: "duke" } },
    { subscriptionId: "gerardo-in", events: ["INBOUND_MESSAGE"], resources: [sender], profile: { profileId: config.inProfileId } },
    { subscriptionId: "gerardo-echo", events: ["BUSINESS_APP_MESSAGE_ECHO"], resources: [sender], profile: { profileId: config.echoProfileId } },
  ] });
  const before = JSON.stringify(p.stored);
  assert.equal((await setup(p)).inbound_subscription_id, "gerardo-in");
  assert.equal(JSON.stringify(p.stored), before);
  assert.equal(p.requests.filter(r => r.method).length, 0);
});

test("unknown existing receiver, wrong account profiles and denied ownership stop before provider writes", async () => {
  for (const record of [
    { events: ["INBOUND_MESSAGE"], profile: { profileId: "foreign" } },
    { events: ["INBOUND_MESSAGE"], profile: { profileId: config.inProfileId }, keywords: ["ORDER"] },
  ]) {
    const p = provider({ records: [{ ...record, subscriptionId: "existing", resources: [sender] }] });
    await assert.rejects(setup(p), /recepción específica diferente/);
    assert.equal(p.requests.filter(r => r.method).length, 0);
  }
  const wrong = provider({ brokenProfile: true });
  await assert.rejects(setup(wrong), /no coincide/);
  const protectedChannel = provider();
  await assert.rejects(setup(protectedChannel, async () => { throw new Error("Protected channel"); }), /Protected/);
  assert.equal(protectedChannel.requests.filter(r => r.method).length, 0);
});

test("configuration and resource validation cannot become an unfiltered subscription", async () => {
  const p = provider();
  await assert.rejects(ensureReadOnlySubscriptions({ api: p.api, config, sender: "", prepareChannel: async () => ({channel_id:channelId}) }));
  await assert.rejects(inspectReadOnlySubscriptions(p.api, { ...config, authId: "" }, sender));
  assert.equal(p.requests.length, 0);
});

test("a multi-number custom receiver is never overridden by a more specific rule", async () => {
  const p = provider({ records: [{ subscriptionId: "shared-custom", events: ["INBOUND_MESSAGE"],
    resources: [sender, "5216861936914"], profile: { profileId: "other" } }] });
  await assert.rejects(setup(p), /recepción específica diferente/);
  assert.equal(p.requests.filter(r => r.method).length, 0);
});
