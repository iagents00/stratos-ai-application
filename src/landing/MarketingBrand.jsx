export default function MarketingBrand({ showIcon = true, href = "#" }) {
  return <a className="smk-brand" href={href} aria-label="Stratos AI, inicio">{showIcon && <img src="/branding/stratos-logo-web-20261016.webp" width="40" height="40" alt="" />}<span>Stratos <span>AI</span></span></a>;
}
