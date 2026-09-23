// Gateway JWT verification also accepts the public anon JWT. Paid operations
// must verify an actual Supabase Auth user before reading or processing input.
export async function requireUser(req: Request): Promise<boolean> {
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return false;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !key) return false;
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: authorization },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const user = await response.json();
    return typeof user.id === "string" && user.role === "authenticated";
  } catch {
    return false;
  }
}
