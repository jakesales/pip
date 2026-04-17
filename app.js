/* global React, ReactDOM, L, PROPERTIES */
const { useState, useMemo, useEffect, useRef } = React;

/* ---------- helpers ---------- */

const RISK_CLASS = {
  Low: 'badge badge-risk-low',
  Medium: 'badge badge-risk-medium',
  High: 'badge badge-risk-high',
};

const SEVERITY_CLASS = {
  Low: 'badge badge-sev-low',
  Medium: 'badge badge-sev-medium',
  High: 'badge badge-sev-high',
  Critical: 'badge badge-sev-critical',
};

const RISK_COLOR = {
  Low: '#22c55e',
  Medium: '#f59e0b',
  High: '#dc4e45',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatGBP(n) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

/* ---------- Filters ---------- */

const RISK_OPTIONS = ['All', 'Low', 'Medium', 'High'];
const SEVERITY_OPTIONS = ['All', 'Low', 'Medium', 'High', 'Critical'];
const DATE_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function Filters({ filters, onChange }) {
  const update = (key) => (e) => onChange({ ...filters, [key]: e.target.value });

  return (
    <div className="filters">
      <label className="filter">
        <span className="filter-label">Risk</span>
        <select value={filters.risk} onChange={update('risk')}>
          {RISK_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>

      <label className="filter">
        <span className="filter-label">Severity</span>
        <select value={filters.severity} onChange={update('severity')}>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="filter">
        <span className="filter-label">Date Added</span>
        <select value={filters.dateAdded} onChange={update('dateAdded')}>
          {DATE_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

/* ---------- PropertyCard ---------- */

function PropertyCard({ property, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`property-card${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(property.id)}
    >
      <div className="property-card-top">
        <div className="property-card-address">
          <div className="property-card-line1">{property.address}</div>
          <div className="property-card-line2">
            {property.city} · {property.postcode}
          </div>
        </div>
        <div className="property-card-type">{property.type}</div>
      </div>

      <div className="property-card-bottom">
        <span className={RISK_CLASS[property.risk]}>{property.risk} risk</span>
        <span className={SEVERITY_CLASS[property.severity]}>{property.severity}</span>
        <span className="property-card-date">Added {formatDate(property.dateAdded)}</span>
      </div>
    </button>
  );
}

/* ---------- Portfolio (left pane) ---------- */

function Portfolio({ properties, totalCount, filters, onFiltersChange, selectedId, onSelect }) {
  return (
    <aside className="portfolio">
      <div className="portfolio-header">
        <div className="portfolio-title-row">
          <h2 className="portfolio-title">Portfolio</h2>
          <span className="portfolio-count">
            {properties.length}
            {properties.length !== totalCount && (
              <span className="portfolio-count-total"> / {totalCount}</span>
            )}
          </span>
        </div>
        <Filters filters={filters} onChange={onFiltersChange} />
      </div>

      <div className="portfolio-list">
        {properties.length === 0 ? (
          <div className="portfolio-empty">No properties match the current filters.</div>
        ) : (
          properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              selected={p.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}

/* ---------- MapView (Leaflet, plain) ---------- */

function MapView({ properties, selectedId, onSelect, visible }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());

  // Initialise map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [54.5, -2.5],
      zoom: 6,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Re-render markers whenever the visible properties change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers.
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();

    properties.forEach((p) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: p.id === selectedId ? 11 : 7,
        color: '#ffffff',
        weight: 2,
        fillColor: RISK_COLOR[p.risk] || '#066abe',
        fillOpacity: 0.9,
      })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup-title">${p.address}</div>
           <div class="map-popup-sub">${p.city} · ${p.postcode}</div>
           <div class="map-popup-meta">
             <span>Risk: <strong>${p.risk}</strong></span>
             <span>Severity: <strong>${p.severity}</strong></span>
           </div>`
        )
        .on('click', () => onSelect(p.id));

      markersRef.current.set(p.id, marker);
    });

    if (properties.length) {
      const latLngs = properties.map((p) => [p.lat, p.lng]);
      map.fitBounds(latLngs, { padding: [40, 40], maxZoom: 11, animate: false });
    }
  }, [properties, onSelect]);

  // Fly to selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const p = properties.find((x) => x.id === selectedId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [selectedId]);

  // Leaflet needs to recalc size whenever the tab becomes visible.
  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 50);
    }
  }, [visible]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" />

      <div className="map-legend">
        <span className="legend-title">Risk</span>
        <span className="legend-item"><i style={{ background: RISK_COLOR.Low }} />Low</span>
        <span className="legend-item"><i style={{ background: RISK_COLOR.Medium }} />Medium</span>
        <span className="legend-item"><i style={{ background: RISK_COLOR.High }} />High</span>
      </div>
    </div>
  );
}

/* ---------- DetailsView ---------- */

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function DetailsView({ property }) {
  if (!property) {
    return (
      <div className="details-empty">
        <div className="details-empty-icon">🏠</div>
        <h3>No property selected</h3>
        <p>
          Choose a property from the portfolio on the left to see its full intelligence profile here.
        </p>
      </div>
    );
  }

  return (
    <div className="details">
      <header className="details-header">
        <div>
          <h2 className="details-address">{property.address}</h2>
          <div className="details-sub">
            {property.city} · {property.postcode}
          </div>
        </div>
        <div className="details-badges">
          <span className={RISK_CLASS[property.risk]}>{property.risk} risk</span>
          <span className={SEVERITY_CLASS[property.severity]}>{property.severity}</span>
        </div>
      </header>

      <section className="details-hero">
        <div className="details-hero-value">
          <div className="details-hero-label">Estimated value</div>
          <div className="details-hero-amount">{formatGBP(property.estimatedValue)}</div>
          <div className="details-hero-meta">
            Last valuation {formatDate(property.lastValuation)}
          </div>
        </div>
        <div className="details-hero-meta-grid">
          <Stat label="Property type" value={property.type} />
          <Stat label="Year built" value={property.yearBuilt} />
          <Stat label="EPC rating" value={property.epc} />
          <Stat label="Flood risk" value={property.floodRisk} />
        </div>
      </section>

      <section className="details-card">
        <h3 className="details-card-title">Specifications</h3>
        <div className="details-grid">
          <Stat label="Bedrooms" value={property.bedrooms} />
          <Stat label="Bathrooms" value={property.bathrooms} />
          <Stat label="Internal area" value={`${property.sqft.toLocaleString()} sqft`} />
          <Stat label="Date added" value={formatDate(property.dateAdded)} />
          <Stat label="Latitude" value={property.lat.toFixed(4)} />
          <Stat label="Longitude" value={property.lng.toFixed(4)} />
        </div>
      </section>

      <section className="details-card">
        <h3 className="details-card-title">Intelligence notes</h3>
        <p className="details-notes">{property.notes}</p>
      </section>
    </div>
  );
}

/* ---------- App ---------- */

const DEFAULT_FILTERS = { risk: 'All', severity: 'All', dateAdded: 'all' };

function applyFilters(items, filters) {
  const now = new Date();
  return items.filter((p) => {
    if (filters.risk !== 'All' && p.risk !== filters.risk) return false;
    if (filters.severity !== 'All' && p.severity !== filters.severity) return false;
    if (filters.dateAdded !== 'all') {
      const days = Number(filters.dateAdded);
      const added = new Date(p.dateAdded);
      const diff = (now - added) / (1000 * 60 * 60 * 24);
      if (diff > days) return false;
    }
    return true;
  });
}

function App() {
  const all = window.PROPERTIES || [];
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState(all[0] ? all[0].id : null);
  const [activeTab, setActiveTab] = useState('map');

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const selectedProperty = useMemo(
    () => all.find((p) => p.id === selectedId) || null,
    [all, selectedId]
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-brand">
          <div className="app-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="14" fill="#066abe" />
              <path
                d="M32 14 L50 28 L50 50 L38 50 L38 38 L26 38 L26 50 L14 50 L14 28 Z"
                fill="white"
              />
            </svg>
          </div>
          <div>
            <h1 className="app-title">Property Intelligence Dashboard</h1>
            <p className="app-subtitle">Monitor risk and severity across your property portfolio</p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Portfolio
          properties={filtered}
          totalCount={all.length}
          filters={filters}
          onFiltersChange={setFilters}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <section className="workspace">
          <div className="tabs">
            <button
              type="button"
              className={`tab${activeTab === 'map' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              Map
            </button>
            <button
              type="button"
              className={`tab${activeTab === 'details' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Details
              {selectedProperty && (
                <span className="tab-hint"> · {selectedProperty.address}</span>
              )}
            </button>
          </div>

          <div className="tab-panel">
            {/* Keep the map mounted so Leaflet doesn't reinitialise; just hide it. */}
            <div style={{ display: activeTab === 'map' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
              <MapView
                properties={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
                visible={activeTab === 'map'}
              />
            </div>

            {activeTab === 'details' && <DetailsView property={selectedProperty} />}
          </div>
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
