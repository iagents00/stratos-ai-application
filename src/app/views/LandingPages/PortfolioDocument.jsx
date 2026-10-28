import { useId, useState } from 'react';
import { ArrowDown, ArrowUpRight, Check, Heart, MapPin, ExternalLink, MessageCircle, Building2 } from 'lucide-react';
import { portfolioPrice, portfolioWhatsApp, safePortfolioUrl, portfolioAccent } from './portfolio-presentation.js';
import './PortfolioDocument.css';

export default function PortfolioDocument({ client, asesor, asesorWA, mensaje, agencyName, properties = [], driveLinks = {} }) {
  const id = useId();
  const [favorites, setFavorites] = useState([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const selected = properties.filter((_, i) => favorites.includes(i));
  const visible = properties.map((property, index) => ({ property, index })).filter(({ index }) => !onlyFavorites || favorites.includes(index));
  const contact = portfolioWhatsApp(asesorWA, asesor, selected.length ? selected : properties);
  const jump = target => {
    const destination = document.getElementById(`${id}-${target}`);
    if (!destination) return;
    destination.focus({ preventScroll: true });
    destination.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  };
  const toggle = index => setFavorites(previous => previous.includes(index) ? previous.filter(item => item !== index) : [...previous, index]);
  const actions = contact && <a className="pd-button pd-primary" href={contact} target="_blank" rel="noreferrer"><MessageCircle size={18} />{selected.length ? 'Consultar favoritas por WhatsApp' : 'Hablar por WhatsApp'}<ArrowUpRight size={17} /></a>;

  return <main className="portfolio-document">
    <div className="pd-cover">
      <header className="pd-masthead pd-wrap"><span className="pd-brand">{agencyName || 'Stratos'}</span><span>Portafolio personalizado</span></header>
      <section className="pd-hero pd-wrap" aria-labelledby={`${id}-title`}>
        <div className="pd-introduction">
          <h1 id={`${id}-title`}><span>Exclusivo para</span>{client?.trim() || 'ti'}</h1>
          <p className="pd-cover-description">Conoce qué ofrece cada propiedad, compara sus detalles y recibe atención directa de tu asesor.</p>
          <button className="pd-button pd-primary" onClick={() => jump('welcome')}>Descubrir mi portafolio <ArrowDown size={18} /></button>
          {contact && <a className="pd-cover-contact" href={contact} target="_blank" rel="noreferrer"><MessageCircle size={17} />Hablar con {asesor || 'mi asesor'} por WhatsApp<ArrowUpRight size={16} /></a>}
        </div>
      </section>
      <div className="pd-cover-foot pd-wrap"><span>{asesor ? `Preparado por ${asesor}` : 'Una selección personalizada'}<strong>{agencyName || 'Stratos'}</strong></span><button className="pd-cover-scroll" onClick={() => jump('selection')}>{properties.length} {properties.length === 1 ? 'propiedad seleccionada' : 'propiedades seleccionadas'}<ArrowDown size={16} /></button></div>
    </div>

    <section className="pd-welcome pd-wrap" id={`${id}-welcome`} tabIndex={-1} aria-labelledby={`${id}-welcome-title`}>
      <div className="pd-letter">
        <h2 id={`${id}-welcome-title`}>Tu próxima decisión merece una selección personal.</h2>
        <p className="pd-message">{mensaje?.trim() || `${client?.trim() ? `${client.trim()}, este` : 'Este'} portafolio reúne las propiedades seleccionadas para ti. Aquí puedes explorar sus características, comparar lo que ofrece cada opción y compartir conmigo tus prioridades. Revisaremos juntos los detalles que necesitas para dar el siguiente paso con claridad.`}</p>
        {asesor && <p className="pd-byline"><strong>{asesor}</strong><span>Tu asesor inmobiliario{agencyName ? ` · ${agencyName}` : ''}</span></p>}
      </div>
      <aside className="pd-index" aria-label="Propiedades de tu portafolio">
        <div className="pd-index-heading"><h2>Dentro de tu portafolio</h2><span>{properties.length} {properties.length === 1 ? 'propiedad' : 'propiedades'}</span></div>
        {properties.map((property, index) => <button className="pd-index-item" style={portfolioAccent(property.accent)} key={index} onClick={() => { setOnlyFavorites(false); requestAnimationFrame(() => jump(`property-${index}`)); }}>
          <span className="pd-index-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{property.name}</strong><small>{property.location || 'Ubicación por confirmar'}</small><small className="pd-index-price">{portfolioPrice(property)}</small></span><ArrowUpRight size={18} />
        </button>)}
      </aside>
    </section>

    <section className="pd-selection pd-wrap" id={`${id}-selection`} tabIndex={-1} aria-labelledby={`${id}-selection-title`}>
      <div className="pd-section-heading"><div><h2 id={`${id}-selection-title`}>Propiedades seleccionadas para ti.</h2><p>Descubre sus características, compara precio y espacio, y consulta directamente con tu asesor la opción que más te interesa.</p></div>
        {properties.length > 1 && <button className="pd-button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(value => !value)}><Heart size={17} fill={onlyFavorites ? 'currentColor' : 'none'} />{onlyFavorites ? 'Ver todas' : `Favoritas (${selected.length})`}</button>}
      </div>
      <p className="pd-sr" role="status">{selected.length} {selected.length === 1 ? 'propiedad favorita' : 'propiedades favoritas'}. {onlyFavorites ? 'Mostrando favoritas.' : 'Mostrando todas.'}</p>
      {visible.length === 0 ? <div className="pd-empty"><Heart size={28} /><h3>Tu selección empieza contigo.</h3><p>Marca el corazón de una propiedad para encontrarla aquí.</p><button className="pd-button" onClick={() => setOnlyFavorites(false)}>Explorar todas las propiedades</button></div> : <>
        {properties.length > 1 && <div className="pd-comparison" role="region" aria-label="Comparación de propiedades; desplaza para ver todas las columnas" tabIndex={0}>
          <table><caption>Comparación de la selección · precios de referencia en USD<span className="pd-comparison-hint">Desliza la tabla para comparar todos los detalles.</span></caption><thead><tr><th scope="col">Propiedad</th><th scope="col">Precio de referencia</th><th scope="col">Tipología</th><th scope="col">Entrega</th><th scope="col">Lo que destaca</th></tr></thead><tbody>{visible.map(({ property, index }) => <tr key={index}><th scope="row"><button onClick={() => jump(`property-${index}`)}>{property.name}<ArrowUpRight size={14} /></button><small>{property.location || 'Por confirmar'}</small></th><td>{portfolioPrice(property)}</td><td>{property.bedrooms || property.type || 'Por confirmar'}</td><td>{property.delivery || 'Por confirmar'}</td><td>{property.highlights?.[0] || property.amenities?.[0] || 'Consulta los detalles con tu asesor'}</td></tr>)}</tbody></table>
        </div>}
        <div className="pd-properties">{visible.map(({ property, index }) => {
          const material = safePortfolioUrl(driveLinks[property.id] ?? property.driveLink);
          const maps = safePortfolioUrl(property.mapsUrl);
          const favorite = favorites.includes(index);
          const propertyContact = portfolioWhatsApp(asesorWA, asesor, [property]);
          const facts = [['Tipo', property.type], ['Tipología', property.bedrooms], ['Superficie', (property.sizes || []).join(' · ')], ['Entrega', property.delivery], ['Zona', property.zone || property.location]].filter(([, value]) => value);
          return <article className="pd-property" style={portfolioAccent(property.accent)} id={`${id}-property-${index}`} tabIndex={-1} key={index} aria-labelledby={`${id}-name-${index}`}>
            <div className="pd-property-summary"><div className="pd-property-top"><span>{property.type || "Selección personal"}</span><button className="pd-favorite" aria-label={`${favorite ? 'Quitar de' : 'Guardar en'} favoritas: ${property.name}`} aria-pressed={favorite} onClick={() => toggle(index)}><Heart size={20} fill={favorite ? 'currentColor' : 'none'} /></button></div>
              <h3 id={`${id}-name-${index}`}>{property.name}</h3><p className="pd-location"><MapPin size={16} />{property.location || 'Ubicación por confirmar'}</p>
              <div className="pd-price"><span>Precio de referencia · USD</span><strong>{portfolioPrice(property)}</strong></div>
              {propertyContact && <a className="pd-button pd-primary pd-property-cta" href={propertyContact} target="_blank" rel="noreferrer" aria-label={`Consultar ${property.name} por WhatsApp`}><MessageCircle size={18} />Consultar por WhatsApp<ArrowUpRight size={16} /></a>}
              {propertyContact && <p className="pd-contact-context">{asesor || 'Tu asesor'} te confirma disponibilidad, precio actualizado y formas de pago.</p>}
              <div className="pd-property-links">{material && <a className="pd-button" href={material} target="_blank" rel="noreferrer">Ver imágenes y detalles <ExternalLink size={16} /></a>}{maps && <a className="pd-button" href={maps} target="_blank" rel="noreferrer"><MapPin size={16} />Ver ubicación</a>}</div>
              {!material && <p className="pd-note">Solicita las imágenes y los materiales a tu asesor.</p>}
            </div>
            <div className="pd-property-detail">
              {property.description && <p className="pd-description">{property.description}</p>}
              {facts.length > 0 && <dl className="pd-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
              {!!property.highlights?.length && <div className="pd-highlights"><h4>Lo que te ofrece esta propiedad</h4><ul>{property.highlights.map((highlight, i) => <li key={i}><Check size={16} /><span>{highlight}</span></li>)}</ul></div>}
              {!!property.amenities?.length && <div className="pd-amenities"><h4>Amenidades</h4><p>{property.amenities.join(' · ')}</p></div>}
              {!property.description && !facts.length && !property.highlights?.length && !property.amenities?.length && <p className="pd-description">Revisa con tu asesor la ficha completa, las unidades disponibles y las condiciones de esta propiedad.</p>}
              {property.roi && <p className="pd-note">Rendimiento indicado en la ficha: {property.roi}. Consulta con tu asesor sus supuestos y condiciones; no constituye una garantía.</p>}

            </div>
          </article>;
        })}</div>
      </>}
    </section>

    <section className="pd-next"><div className="pd-wrap pd-next-layout"><div><Building2 size={28} strokeWidth={1.4} /><h2>Conoce más.<br />Decide con tu asesor.</h2><p>{asesor ? `${asesor} te acompaña a revisar ` : 'Revisa con tu asesor '}las opciones que te interesan, resolver tus preguntas y confirmar las condiciones antes de avanzar.</p>{selected.length > 0 && <p className="pd-shortlist"><Heart size={16} />Tus favoritas: {selected.map(p => p.name).join(' · ')}</p>}<div className="pd-actions">{actions}</div>{!contact && <p className="pd-note">Responde al mensaje donde recibiste este portafolio para continuar con tu asesor.</p>}</div><ol className="pd-steps"><li><strong>Elige lo que te interesa</strong><p>Explora las fichas y guarda las propiedades que más te gusten.</p></li><li><strong>Habla por WhatsApp</strong><p>Solicita precio actualizado, disponibilidad y condiciones de compra.</p></li><li><strong>Conoce la propiedad</strong><p>Acuerda con tu asesor una visita o una presentación de las opciones.</p></li></ol></div></section>
    <footer className="pd-wrap pd-footer"><strong>{agencyName || 'Stratos'}</strong><p>Preparado para {client || 'ti'}{asesor ? ` · Asesor: ${asesor}` : ''}</p><p>Precios de referencia en USD, sujetos a disponibilidad y confirmación. Las favoritas se conservan mientras mantengas abierto este portafolio.</p></footer>
  </main>;
}
