import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);

function worker() {
  const handlers = new Map();
  const cacheReads = [];
  const cached = new Response("stale-release");
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://getstratosai.com" },
      addEventListener: (name, handler) => handlers.set(name, handler),
    },
    URL,
    caches: {
      match: async (request) => {
        cacheReads.push(request.url);
        return cached;
      },
    },
    fetch: async () => {
      throw new Error("network unavailable");
    },
  });
  return { fetchHandler: handlers.get("fetch"), cacheReads };
}

test("release references bypass an existing worker cache without a stale fallback", () => {
  for (const path of [
    "/release.json",
    "/release.json?audit=release",
    "/release.json?version=next",
  ]) {
    const { fetchHandler, cacheReads } = worker();
    const request = new Request("https://getstratosai.com" + path);
    let intercepted = false;
    fetchHandler({
      request,
      respondWith: () => {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false);
    assert.deepEqual(cacheReads, []);
  }
});

test("no-store JSON requests bypass caches while ordinary assets retain their offline strategy", async () => {
  const { fetchHandler, cacheReads } = worker();
  let intercepted;
  fetchHandler({
    request: new Request("https://getstratosai.com/other.json", {
      cache: "no-store",
    }),
    respondWith: (response) => {
      intercepted = response;
    },
  });
  assert.equal(intercepted, undefined);
  assert.deepEqual(cacheReads, []);
  fetchHandler({
    request: new Request("https://getstratosai.com/manifest.webmanifest"),
    respondWith: (response) => {
      intercepted = response;
    },
  });
  assert.equal(await (await intercepted).text(), "stale-release");
  assert.deepEqual(cacheReads, [
    "https://getstratosai.com/manifest.webmanifest",
  ]);
});
