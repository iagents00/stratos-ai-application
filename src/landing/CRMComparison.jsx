import { COMPARISON_REVIEWED, COMPARISON_SOURCES, CRM_COMPARISON } from './crm-comparison.mjs';
import { FEATURES } from './features-content.mjs';

const vendors = [ ['stratos', 'Stratos AI'], ['hubspot', 'HubSpot'], ['salesforce', 'Salesforce'], ['highlevel', 'GoHighLevel'] ];
export default function CRMComparison() {
  return <section className="sf-section sf-rivals-section" id="comparar-crm"><div className="sf-container">
    <p className="sf-eyebrow">STRATOS AI · HUBSPOT · SALESFORCE · GOHIGHLEVEL</p>
    <h2>Compara cómo<br/>trabajaría tu equipo.</h2>
    <p className="sf-section-intro">Los {FEATURES.length} usos del catálogo, agrupados por capacidad. Revisa qué ofrece cada plataforma y qué necesita configuración, otro plan o una validación específica.</p>
    <p className="sf-comparison-method">Comparación de documentación oficial, revisada el {COMPARISON_REVIEWED}. «Disponible» indica una capacidad documentada, no que esté incluida en todos los planes ni que reproduzca exactamente el mismo flujo. «Validar alcance» señala que la equivalencia completa no está confirmada.</p>
    <p className="sf-table-hint" id="rivals-help">Abre el listado de cada capacidad para ver las funciones de Stratos que reúne. Desliza horizontalmente para comparar las cuatro plataformas.</p>
    <div className="sf-comparison-scroll" role="region" aria-label="Comparación con HubSpot, Salesforce y GoHighLevel" aria-describedby="rivals-help" tabIndex={0}>
      <table className="sf-rivals"><caption className="sf-sr-only">Comparación por capacidad: Stratos AI, HubSpot, Salesforce y GoHighLevel</caption><thead><tr><th scope="col">Capacidad</th>{vendors.map(([id,name])=><th key={id} scope="col">{name}</th>)}</tr></thead>
        <tbody>{CRM_COMPARISON.map(row=><tr key={row.id}><th scope="row">{row.title}{row.featureIds.length>0 && <details className="sf-covered-features"><summary>Ver {row.featureIds.length} funciones</summary><ul>{row.featureIds.map(id=><li key={id}>{FEATURES.find(feature=>feature.id===id)?.title}</li>)}</ul></details>}</th>{vendors.map(([vendor])=><td key={vendor}><span className="sf-comparison-status">{row[vendor].status}</span><p>{row[vendor].text}</p>{row[vendor].sources.length>0 && <div className="sf-cell-sources">{row[vendor].sources.map((key,index)=><a key={key} href={COMPARISON_SOURCES[key].url} target="_blank" rel="noopener noreferrer" aria-label={`${COMPARISON_SOURCES[key].label}: fuente para ${row.title}`}>Fuente{row[vendor].sources.length>1 ? ` ${index+1}` : ''} ↗</a>)}</div>}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="sf-comparison-method">Cada proveedor tiene un catálogo más amplio. Esta tabla compara los usos comerciales de esta página; no es una evaluación de todas sus herramientas. Las configuraciones propuestas deben comprobarse en una demo. Los nombres pertenecen a sus respectivas marcas.</p>
    <a className="sf-text-link" href="#catalogo">Consultar el antes y después de las {FEATURES.length} funciones ↓</a>
  </div></section>;
}
