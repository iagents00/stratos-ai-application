const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("Falta la llave de credenciales temporales.");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`stratos-temporary-credentials:v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptTemporaryPassword(password: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(password));
  return { encrypted_password: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv), key_version: 1 };
}

export async function decryptTemporaryPassword(ciphertext: string, iv: string, secret: string) {
  const key = await encryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext),
  );
  return decoder.decode(plaintext);
}

export async function saveTemporaryCredential(
  admin: any,
  secret: string,
  input: {
    user_id: string;
    organization_id: string;
    user_name: string;
    login_email: string;
    password: string;
    created_by: string;
  },
) {
  const encrypted = await encryptTemporaryPassword(input.password, secret);
  const { error } = await admin.from("temporary_login_credentials").upsert({
    user_id: input.user_id,
    organization_id: input.organization_id,
    user_name: input.user_name,
    login_email: input.login_email,
    encrypted_password: encrypted.encrypted_password,
    encryption_iv: encrypted.iv,
    key_version: encrypted.key_version,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function decryptCredentialRows(rows: any[], secret: string) {
  const output = [];
  for (const row of rows || []) {
    try {
      output.push({
        user_id: row.user_id,
        organization_id: row.organization_id,
        user_name: row.user_name,
        login_email: row.login_email,
        temporary_password: await decryptTemporaryPassword(row.encrypted_password, row.encryption_iv, secret),
        created_at: row.created_at,
      });
    } catch {
      // Una rotación de llave nunca debe devolver basura ni filtrar el cifrado.
    }
  }
  return output;
}
