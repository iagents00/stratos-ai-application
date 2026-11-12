// Sender quality is a filtered lookup, not an account-wide sender listing.
export function senderQualityUrl(baseUrl, phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) throw new Error("Invalid WhatsApp sender");
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/whatsapp/1/senders/quality`);
  const senders = [digits];
  if (/^52[0-9]{10}$/.test(digits)) senders.push(`521${digits.slice(2)}`);
  if (/^521[0-9]{10}$/.test(digits)) senders.push(`52${digits.slice(3)}`);
  // The provider accepts a comma-separated list. Query both representations
  // of this exact Mexico number; comparison still requires its identity.
  url.searchParams.set("senders", senders.join(","));
  return url.toString();
}

export function sameWhatsAppPhone(left, right) {
  const canon = value => {
    const digits = String(value ?? "").replace(/\D/g, "");
    // Meta/Infobip may return the historical Mexico mobile prefix 521.
    return /^521[0-9]{10}$/.test(digits) ? `52${digits.slice(3)}` : digits;
  };
  const a = canon(left);
  return /^[1-9][0-9]{7,14}$/.test(a) && a === canon(right);
}
