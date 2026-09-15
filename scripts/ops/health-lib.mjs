/** Read-only probes. Never emit payloads, secrets or client records. */
export async function probe(
  name,
  url,
  { fetcher = fetch, headers, validate = () => true } = {},
) {
  const start = Date.now();
  let status = 0;
  try {
    const response = await fetcher(url, {
      headers,
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    status = response.status;
    if (!response.ok)
      return {
        name,
        ok: false,
        status: response.status,
        ms: Date.now() - start,
      };
    const detail = await validate(response);
    return {
      name,
      ok: detail !== false,
      status: response.status,
      ms: Date.now() - start,
      ...(typeof detail === "object" ? { detail } : {}),
    };
  } catch (e) {
    return {
      name,
      ok: false,
      status,
      ms: Date.now() - start,
      error:
        e.name === "TimeoutError"
          ? "timeout"
          : status
            ? "invalid_response"
            : "network_error",
    };
  }
}
export async function webProbe(origin, expectedCommit, fetcher = fetch) {
  const root = new URL(origin).origin;
  const checks = await Promise.all([
    probe("web", root, {
      fetcher,
      validate: async (r) => {
        const html = await r.text();
        const asset = html.match(/<script[^>]+src=["']([^"']+\.js)["']/)?.[1];
        if (!asset) return false;
        const url = new URL(asset, root);
        if (url.origin !== root) return false;
        const child = await probe("entry_asset", url.href, {
          fetcher,
          validate: (r) =>
            /javascript/.test(r.headers.get("content-type") || ""),
        });
        return child.ok ? { asset: url.pathname } : false;
      },
    }),
    probe("release", `${root}/release.json`, {
      fetcher,
      validate: async (r) => {
        const j = await r.json();
        return /^[a-f0-9]{40}$/.test(j.commit || "") &&
          /^stratos-v\d+$/.test(j.serviceWorker || "") &&
          j.dirty === false &&
          (!expectedCommit || j.commit === expectedCommit)
          ? { commit: j.commit, serviceWorker: j.serviceWorker }
          : false;
      },
    }),
    probe("service_worker", `${root}/sw.js`, {
      fetcher,
      validate: async (r) => {
        const version = (await r.text()).match(/stratos-v\d+/)?.[0];
        return version ? { version } : false;
      },
    }),
  ]);
  const release = checks.find((c) => c.name === "release");
  const sw = checks.find((c) => c.name === "service_worker");
  if (release.ok && sw.ok && release.detail.serviceWorker !== sw.detail.version)
    release.ok = false;
  return checks;
}
