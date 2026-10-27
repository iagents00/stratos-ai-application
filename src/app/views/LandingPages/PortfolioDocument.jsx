import { useId, useState } from 'react';
import { ArrowDown, ArrowUpRight, Check, Heart, MapPin, ExternalLink, CalendarDays, MessageCircle, Building2 } from 'lucide-react';
import { portfolioPrice, portfolioWhatsApp, safePortfolioUrl } from './portfolio-presentation.js';
import './PortfolioDocument.css';

export default function PortfolioDocument({ client, asesor, asesorWA, asesorCal, mensaje, agencyName, properties = [], driveLinks = {} }) {
  const id = useId();
  const [favorites, setFavorites] = useState([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const selected = properties.filter((_, i) => favorites.includes(i));
  const visible = properties.map((property, index) => ({ property, index })).filter(({ index }) => !onlyFavorites || favorites.includes(index));
  const contact = portfolioWhatsApp(asesorWA, asesor, selected.length ? selected : properties);
  const calendar = safePortfolioUrl(asesorCal);
  const jump = target => {
    const destination = document.getElementById(`${id}-${target}`);
    if (!destination) return;
    destination.focus({ preventScroll: true });
    destination.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  };
  const toggle = index => setFavorites(previous => previous.includes(index) ? previous.filter(item => item !== index) : [...previous, index]);
  const actions = <>{contact && <a className="pd-button pd-primary" href={contact} target="_blank" rel="noreferrer"><MessageCircle size={18} />{selected.length ? 'Consultar mis favoritas' : 'Hablar con mi asesor'}<ArrowUpRight size={17} /></a>}{calendar && <a className="pd-button" href={calendar} target="_blank" rel="noreferrer"><CalendarDays size={18} />Agendar conversación</a>}</>;

  return <main className="portfolio-document">
    <header className="pd-masthead pd-wrap"><span className="pd-brand">{agencyName || 'Stratos'}</span><span>Portafolio personal</span></header>
    <section className="pd-hero pd-wrap" aria-labelledby={`${id}-title`}>
      <div className="pd-introduction">
        <h1 id={`${id}-title`}>Tu próxima propiedad,<br /><em>{client || 'a tu medida'}.</em></h1>
        <p className="pd-message">{mensaje || 'Una selección para explorar con calma, comparar lo que importa y dar el siguiente paso con tu asesor.'}</p>
        {asesor && <p className="pd-byline">Preparado por <strong>{asesor}</strong></p>}
        <button className="pd-button pd-primary" onClick={() => jump('selection')}>Explorar la selección <ArrowDown size={18} /></button>
      </div>
      <aside className="pd-index" aria-label="Propiedades de tu portafolio">
        <div className="pd-index-heading"><h2>Tu selección</h2><span>{properties.length} {properties.length === 1 ? 'propiedad' : 'propiedades'}</span></div>
        {properties.map((property, index) => <button className="pd-index-item" key={index} onClick={() => { setOnlyFavorites(false); requestAnimationFrame(() => jump(`property-${index}`)); }}>
          <span className="pd-index-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{property.name}</strong><small>{property.location || 'Ubicación por confirmar'}</small></span><ArrowUpRight size={18} />
        </button>)}
      </aside>
    </section>

    <section className="pd-selection pd-wrap" id={`${id}-selection`} tabIndex={-1} aria-labelledby={`${id}-selection-title`}>
      <div className="pd-section-heading"><div><h2 id={`${id}-selection-title`}>Una mirada a tus opciones.</h2><p>Compara los datos y guarda las propiedades que quieras conversar.</p></div>
        {properties.length > 1 && <button className="pd-button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(value => !value)}><Heart size={17} fill={onlyFavorites ? 'currentColor' : 'none'} />{onlyFavorites ? 'Ver todas' : `Favoritas (${selected.length})`}</button>}
      </div>
      <p className="pd-sr" role="status">{selected.length} {selected.length === 1 ? 'propiedad favorita' : 'propiedades favoritas'}. {onlyFavorites ? 'Mostrando favoritas.' : 'Mostrando todas.'}</p>
      {visible.length === 0 ? <div className="pd-empty"><Heart size={28} /><h3>Tu selección empieza contigo.</h3><p>Marca el corazón de una propiedad para encontrarla aquí.</p><button className="pd-button" onClick={() => setOnlyFavorites(false)}>Explorar todas las propiedades</button></div> : <>
        {properties.length > 1 && <div className="pd-comparison" role="region" aria-label="Comparación de propiedades; desplaza para ver todas las columnas" tabIndex={0}>
          <table><caption>Comparación de la selección · precios de referencia en USD</caption><thead><tr><th scope="col">Propiedad</th><th scope="col">Precio de referencia</th><th scope="col">Tipología</th><th scope="col">Entrega</th></tr></thead><tbody>{visible.map(({ property, index }) => <tr key={index}><th scope="row"><button onClick={() => jump(`property-${index}`)}>{property.name}<ArrowUpRight size={14} /></button><small>{property.location || 'Por confirmar'}</small></th><td>{portfolioPrice(property)}</td><td>{property.bedrooms || property.type || 'Por confirmar'}</td><td>{property.delivery || 'Por confirmar'}</td></tr>)}</tbody></table>
        </div>}
        <div className="pd-properties">{visible.map(({ property, index }) => {
          const material = safePortfolioUrl(driveLinks[property.id] || property.driveLink);
          const maps = safePortfolioUrl(property.mapsUrl);
          const favorite = favorites.includes(index);
          const facts = [['Tipo', property.type], ['Tipología', property.bedrooms], ['Superficie', (property.sizes || []).join(' · ')], ['Entrega', property.delivery], ['Zona', property.zone || property.location]].filter(([, value]) => value);
          return <article className="pd-property" id={`${id}-property-${index}`} tabIndex={-1} key={index} aria-labelledby={`${id}-name-${index}`}>
            <div className="pd-property-summary"><div className="pd-property-top"><button className="pd-favorite" aria-label={`${favorite ? 'Quitar de' : 'Guardar en'} favoritas: ${property.name}`} aria-pressed={favorite} onClick={() => toggle(index)}><Heart size={20} fill={favorite ? 'currentColor' : 'none'} /></button></div>
              <h3 id={`${id}-name-${index}`}>{property.name}</h3><p className="pd-location"><MapPin size={16} />{property.location || 'Ubicación por confirmar'}</p>
              <div className="pd-price"><span>Precio de referencia · USD</span><strong>{portfolioPrice(property)}</strong></div>
              <div className="pd-property-links">{material && <a className="pd-button pd-primary" href={material} target="_blank" rel="noreferrer">Explorar material <ExternalLink size={16} /></a>}{maps && <a className="pd-button" href={maps} target="_blank" rel="noreferrer"><MapPin size={16} />Ver ubicación</a>}</div>
              {!material && <p className="pd-note">Solicita las imágenes y los materiales a tu asesor.</p>}
            </div>
            <div className="pd-property-detail">
              {property.description && <p className="pd-description">{property.description}</p>}
              {facts.length > 0 && <dl className="pd-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
              {!!property.highlights?.length && <div className="pd-highlights"><h4>Detalles para considerar</h4><ul>{property.highlights.map((highlight, i) => <li key={i}><Check size={16} /><span>{highlight}</span></li>)}</ul></div>}
              {!!property.amenities?.length && <div className="pd-amenities"><h4>Amenidades</h4><p>{property.amenities.join(' · ')}</p></div>}
              {!property.description && !facts.length && !property.highlights?.length && !property.amenities?.length && <p className="pd-description">Revisa con tu asesor la ficha completa, las unidades disponibles y las condiciones de esta propiedad.</p>}
              {property.roi && <p className="pd-note">Rendimiento indicado en la ficha: {property.roi}. Consulta con tu asesor sus supuestos y condiciones; no constituye una garantía.</p>}
              {contact && <a className="pd-text-link" href={portfolioWhatsApp(asesorWA, asesor, [property])} target="_blank" rel="noreferrer">Consultar esta propiedad <ArrowUpRight size={17} /></a>}
            </div>
          </article>;
        })}</div>
      </>}
    </section>

    <section className="pd-next"><div className="pd-wrap pd-next-layout"><div><Building2 size={28} strokeWidth={1.4} /><h2>De la selección<br />a una decisión informada.</h2><p>{asesor ? `${asesor} te acompaña a revisar ` : 'Revisa con tu asesor '}disponibilidad, condiciones y los detalles que hacen la diferencia para ti.</p>{selected.length > 0 && <p className="pd-shortlist"><Heart size={16} />Tus favoritas: {selected.map(p => p.name).join(' · ')}</p>}<div className="pd-actions">{actions}</div>{!contact && !calendar && <p className="pd-note">Responde al mensaje donde recibiste este portafolio para continuar con tu asesor.</p>}</div><ol className="pd-steps"><li><strong>Elige lo que te interesa</strong><p>Guarda tus favoritas y anota las dudas que quieras resolver.</p></li><li><strong>Confirma los detalles</strong><p>Solicita precio actualizado, disponibilidad y condiciones de compra.</p></li><li><strong>Conoce la propiedad</strong><p>Acuerda con tu asesor una visita o una presentación de las opciones.</p></li></ol></div></section>
    <footer className="pd-wrap pd-footer"><strong>{agencyName || 'Stratos'}</strong><p>Preparado para {client || 'ti'}{asesor ? ` · Asesor: ${asesor}` : ''}</p><p>Precios de referencia en USD, sujetos a disponibilidad y confirmación. Las favoritas se conservan mientras mantengas abierto este portafolio.</p></footer>
  </main>;
}
