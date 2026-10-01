/** La vista previa conserva la ruta y el cliente; nunca arrastra el hash de autenticación. */
export function rutaVistaPreviaRails(href) {
  const url = new URL(href);
  url.searchParams.set('app', '');
  url.searchParams.set('rails', '1');
  return `${url.pathname}${url.search}`;
}
