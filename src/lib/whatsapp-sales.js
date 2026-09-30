/**
 * Contacto comercial de Stratos AI para las experiencias públicas de venta.
 *
 * Se mantiene en un solo sitio para que los CTAs de las landings y de las
 * rutas públicas no terminen apuntando a números distintos por accidente.
 */
export const STRATOS_WHATSAPP = "17479779711";

const clean = (value) => String(value || "").trim();

export const buildWhatsAppUrl = (message, phone = STRATOS_WHATSAPP) => (
  `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(clean(message))}`
);

export const buildSalesMessage = ({ intent, product, price, details = [], source } = {}) => {
  const context = [
    product && `Producto o servicio: ${clean(product)}`,
    price && `Precio publicado: ${clean(price)}`,
    ...details.map(clean).filter(Boolean),
    source && `Origen: ${clean(source)}`,
  ].filter(Boolean);

  return [
    "Hola, estoy viendo Stratos AI.",
    clean(intent) || "Quiero recibir información y conocer las opciones disponibles.",
    context.length ? "" : null,
    ...context,
    "",
    "¿Me pueden atender por este medio?",
  ].filter((line) => line !== null).join("\n");
};

export const buildPortfolioMessage = ({ client, property } = {}) => {
  const greeting = client ? `Hola, soy ${clean(client)}.` : "Hola.";
  const propertyLine = property?.name
    ? `Me interesa conocer más sobre ${clean(property.name)}.`
    : "Estoy viendo una selección de propiedades en la Riviera Maya.";
  const context = property?.name ? [
    `Desarrollo: ${clean(property.name)}`,
    property.location && `Ubicación: ${clean(property.location)}`,
    (property.priceLabel || property.ticket) && `Rango publicado: ${clean(property.priceLabel || property.ticket)}`,
    property.roi && `ROI publicado: ${clean(property.roi)}`,
    property.delivery && `Entrega: ${clean(property.delivery)}`,
  ].filter(Boolean) : [];

  return [
    greeting,
    propertyLine,
    context.length ? "" : null,
    ...context,
    "",
    "¿Me pueden compartir disponibilidad, imágenes y formas de pago?",
  ].filter((line) => line !== null).join("\n");
};

export const buildPropertyMessage = ({ action, property, client } = {}) => {
  const name = clean(property?.name) || "esta propiedad";
  const location = clean(property?.location);
  const zone = clean(property?.zone);
  const type = clean(property?.type || property?.bedrooms);
  const roi = clean(property?.roi);
  const delivery = clean(property?.delivery);
  const price = clean(property?.priceLabel || property?.ticket);
  const context = [
    `Desarrollo: ${name}`,
    location && `Ubicación: ${location}${zone && zone !== location ? ` · ${zone}` : ""}`,
    type && `Tipología: ${type}`,
    price && `Rango publicado: ${price}`,
    roi && `ROI publicado: ${roi}`,
    delivery && `Entrega: ${delivery}`,
  ].filter(Boolean);

  const intro = client ? `Hola, soy ${clean(client)}.` : "Hola.";
  const request = action || "Quiero recibir información y disponibilidad.";

  return [
    intro,
    request,
    "",
    ...context,
    "",
    "¿Me ayudan con los detalles y las opciones disponibles?",
  ].join("\n");
};
