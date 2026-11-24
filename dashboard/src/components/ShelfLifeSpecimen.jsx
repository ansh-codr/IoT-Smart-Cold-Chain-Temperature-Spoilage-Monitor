export function ShelfLifeSpecimen({ percent = 0, rateFactor = 1 }) {
  const life = Math.max(0, Math.min(100, Number(percent) || 0));
  const stressed = life < 35 || Number(rateFactor) > 1.2;
  return <section className={`specimen ${stressed ? 'specimen--stressed' : ''}`} style={{ '--life': `${life}%` }}>
    <div><p className="specimen__eyebrow">LIVE SHELF-LIFE SPECIMEN</p><p className="specimen__value">{life.toFixed(1)}<small>%</small></p><p className="specimen__meta">Burn rate {Number(rateFactor).toFixed(2)}× reference</p></div>
    <svg viewBox="0 0 180 180" aria-label={`Shelf life ${life.toFixed(1)} percent`}><defs><linearGradient id="thermal" x1="0" x2="0" y1="1" y2="0"><stop stopColor="#ff6b2d"/><stop offset="1" stopColor="#c9ff4a"/></linearGradient></defs><path className="specimen__crate" d="M35 43h110v95H35zM35 71h110M61 43v95m58-95v95"/><rect className="specimen__fill" x="39" y="47" width="102" height="87"/><path className="specimen__crack" d="m92 49-8 29 13 12-12 28 15 18"/></svg>
  </section>;
}
