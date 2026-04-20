/* global React, ReactDOM, L */
const { useState, useMemo, useEffect, useRef } = React;

/* ---------- helpers ---------- */

const SEVERITY_CLASS = {
  Low: 'badge badge-sev-low',
  Medium: 'badge badge-sev-medium',
  High: 'badge badge-sev-high',
  Critical: 'badge badge-sev-critical',
};

const SEVERITY_COLOR = {
  Low: '#6e7981',
  Medium: '#f59e0b',
  High: '#dc4e45',
  Critical: '#7c3aed',
};

const STATUS_CLASS = {
  'New': 'pill pill-status-new',
  'In review': 'pill pill-status-review',
  'Action required': 'pill pill-status-action',
  'Awaiting customer': 'pill pill-status-waiting',
  'Resolved': 'pill pill-status-resolved',
  'Snoozed': 'pill pill-status-snoozed',
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

// Outward postcode = first part (e.g. "SW1A 2AA" -> "SW1A").
function outwardCode(postcode) {
  return (postcode || '').split(' ')[0];
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

/* ---------- Filters ---------- */

const DATE_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const HMO_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date added · newest first' },
  { value: 'date-asc', label: 'Date added · oldest first' },
  { value: 'alert-desc', label: 'High alert first' },
];

const SEVERITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const SUMMARY_TAG_ORDER = [
  'Flood/subsidence exposure',
  'Crime spikes',
  'Environmental risk',
  'EPC Rating',
  'Listed Building',
  'Non-Standard construction',
];
const ADDRESS_STEM_OPTIONS = [
  'Station Road',
  'High Street',
  'Church Lane',
  'Park Avenue',
  'Victoria Road',
];

function SummaryTagIcon({ tag }) {
  const base = { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' };
  if (tag === 'Flood/subsidence exposure') {
    return (
      <svg {...base}>
        <path d="M12 3 C10 6 7 9 7 12 A5 5 0 0 0 17 12 C17 9 14 6 12 3 Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 18 C5 17 6 17 7 18 C8 19 9 19 10 18 C11 17 12 17 13 18 C14 19 15 19 16 18 C17 17 18 17 20 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (tag === 'Crime spikes') {
    return (
      <svg {...base}>
        <path d="M4 14 L10 8 L14 12 L20 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 6 H20 V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (tag === 'Environmental risk') {
    return (
      <svg {...base}>
        <path d="M6 14 C6 10 10 7 15 6 C14 11 11 16 7 17 C6.4 16 6 15 6 14 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 16 L12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (tag === 'EPC Rating') {
    return (
      <svg {...base}>
        <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9 H16 M8 13 H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (tag === 'Listed Building') {
    return (
      <svg {...base}>
        <path d="M4 9 L12 4 L20 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10 V18 M10 10 V18 M14 10 V18 M18 10 V18 M4 18 H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...base}>
      <path d="M4 18 H20 M6 18 V12 L10 8 V18 M14 18 V10 L18 6 V18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SummaryBar({ counts, taggedTotal, activeTag, onTagToggle }) {
  return (
    <section className="summary-bar" aria-label="Alert tag summary">
      <div className="summary-bar-title">
        <span className="summary-bar-title-main">Current Alerts by Dataset</span>
        <span className="summary-bar-title-sub">{taggedTotal} tagged properties</span>
      </div>
      <div className="summary-cards">
        {SUMMARY_TAG_ORDER.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`summary-card${activeTag === tag ? ' is-active' : ''}`}
            onClick={() => onTagToggle(tag)}
            aria-pressed={activeTag === tag}
          >
            <span className="summary-card-icon">
              <SummaryTagIcon tag={tag} />
            </span>
            <span className="summary-card-label">{tag}</span>
            <span className="summary-card-count">{counts[tag] || 0}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function nextPropertyId(existing) {
  const highest = existing.reduce((max, p) => {
    const n = Number(String(p.id || '').replace('p-', ''));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `p-${String(highest + 1).padStart(3, '0')}`;
}

function postcodeArea(postcode) {
  return (postcode || '').trim().toUpperCase().split(' ')[0] || 'SW1A';
}

function postcodeDistrict(postcode) {
  const area = postcodeArea(postcode);
  const letters = (area.match(/^[A-Z]+/) || ['SW'])[0];
  const numbers = (area.match(/\d+/) || ['1'])[0];
  return `${letters}${numbers}`;
}

function makeAddressOptions(postcode) {
  const district = postcodeDistrict(postcode);
  return ADDRESS_STEM_OPTIONS.map((stem, idx) => ({
    value: `${idx + 10} ${stem}, ${district}`,
    label: `${idx + 10} ${stem}, ${district}`,
  }));
}

function createNewProperty({ postcode, address }, existing) {
  const id = nextPropertyId(existing);
  const area = postcodeArea(postcode);
  const nearby = existing.filter((p) => outwardCode(p.postcode) === area);
  const nowIso = new Date().toISOString().slice(0, 10);
  const baseLat = nearby.length
    ? nearby.reduce((sum, p) => sum + p.lat, 0) / nearby.length
    : 51.475;
  const baseLng = nearby.length
    ? nearby.reduce((sum, p) => sum + p.lng, 0) / nearby.length
    : -0.18;
  const jitter = () => (Math.random() * 2 - 1) * 0.004;
  const avgValue = nearby.length
    ? Math.round(nearby.reduce((sum, p) => sum + p.estimatedValue, 0) / nearby.length)
    : 850000;

  return {
    id,
    address,
    city: nearby[0] ? nearby[0].city : 'London',
    postcode: postcode.trim().toUpperCase(),
    lat: baseLat + jitter(),
    lng: baseLng + jitter(),
    severity: 'Low',
    dateAdded: nowIso,
    signalType: 'Listing detected',
    workflowStatus: 'New',
    assignedTo: 'Unassigned',
    type: nearby[0] ? nearby[0].type : 'Flat',
    bedrooms: 2,
    bathrooms: 1,
    sqft: 800,
    yearBuilt: 1998,
    estimatedValue: avgValue,
    lastValuation: nowIso,
    tenure: 'Leasehold',
    epc: 'C',
    isUnlicensedHmo: false,
    floodRisk: 'Low',
    notes: 'Newly added property awaiting full enrichment and signal refresh.',
    pillTag: 'NEW',
    alertTags: [],
  };
}

function sortProperties(items, sortBy) {
  const copy = items.slice();
  if (sortBy === 'date-asc') {
    copy.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
    return copy;
  }
  if (sortBy === 'alert-desc') {
    copy.sort((a, b) => {
      const aTagged = (a.alertTags && a.alertTags.length > 0) ? 1 : 0;
      const bTagged = (b.alertTags && b.alertTags.length > 0) ? 1 : 0;
      if (aTagged !== bTagged) return bTagged - aTagged;
      const sev = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
      if (sev !== 0) return sev;
      return b.dateAdded.localeCompare(a.dateAdded);
    });
    return copy;
  }
  copy.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  return copy;
}

function FilterSelect({ label, value, onChange, options, hint }) {
  return (
    <label className="filter">
      <span className="filter-label">
        {label}
        {hint && <span className="filter-hint">{hint}</span>}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </label>
  );
}

function Filters({ filters, onChange, options }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });

  return (
    <div className="filter-groups">
      <div className="filter-group">
        <div className="filter-group-header">
          <span className="filter-group-title">Standard filters</span>
        </div>
        <div className="filters">
          <FilterSelect
            label="Postcode"
            value={filters.postcode}
            onChange={set('postcode')}
            options={['All', ...options.postcodes]}
          />
          <FilterSelect
            label="Property type"
            value={filters.propertyType}
            onChange={set('propertyType')}
            options={['All', ...options.propertyTypes]}
          />
          <FilterSelect
            label="Signal type"
            value={filters.signalType}
            onChange={set('signalType')}
            options={['All', ...options.signalTypes]}
          />
          <FilterSelect
            label="Signal severity"
            value={filters.severity}
            onChange={set('severity')}
            options={['All', ...options.severities]}
          />
          <FilterSelect
            label="Signal date range"
            value={filters.dateAdded}
            onChange={set('dateAdded')}
            options={DATE_OPTIONS}
          />
          <FilterSelect
            label="Workflow status"
            value={filters.workflowStatus}
            onChange={set('workflowStatus')}
            options={['All', ...options.workflowStatuses]}
          />
          <FilterSelect
            label="Assigned owner / team"
            value={filters.assignedTo}
            onChange={set('assignedTo')}
            options={['All', ...options.owners]}
          />
        </div>
      </div>

      <div className="filter-group filter-group-custom">
        <div className="filter-group-header">
          <span className="filter-group-title">Dataset filters</span>
          <span className="filter-group-tag">Dataset</span>
        </div>
        <div className="filters">
          <FilterSelect
            label="Dataset"
            value={filters.summaryTag}
            onChange={set('summaryTag')}
            options={['All', ...SUMMARY_TAG_ORDER]}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------- PropertyCard ---------- */

function AlertIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 L22 20 H2 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 9 V14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill="white" />
    </svg>
  );
}

function AlertTags({ tags, compact }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className={`alert-tags${compact ? ' alert-tags-compact' : ''}`}>
      {tags.map((t) => (
        <span key={t} className="alert-tag">
          <AlertIcon />
          {t}
        </span>
      ))}
    </div>
  );
}

function PropertyCard({ property, selected, onSelect }) {
  const hasAlerts = property.alertTags && property.alertTags.length > 0;
  return (
    <button
      type="button"
      className={`property-card${selected ? ' is-selected' : ''}${hasAlerts ? ' has-alerts' : ''}`}
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
        {property.pillTag && <span className="signal-type">{property.pillTag}</span>}
        <span className="property-card-meta">
          {property.workflowStatus} · {property.severity} · {property.assignedTo} · {formatDate(property.dateAdded)}
        </span>
      </div>
    </button>
  );
}

/* ---------- Portfolio (left pane) ---------- */

function countActiveFilters(filters) {
  return Object.values(filters).filter((v) => v !== 'All' && v !== 'all').length;
}

function Portfolio({
  properties, totalCount, filters, onFiltersChange, onFiltersReset,
  sortBy, onSortChange, options, selectedId, onSelect, onAddProperty,
}) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const activeCount = countActiveFilters(filters);
  const sortLabel =
    (SORT_OPTIONS.find((o) => o.value === sortBy) || SORT_OPTIONS[0]).label;

  return (
    <aside className="portfolio">
      <div className="portfolio-header">
        <div className="portfolio-title-row">
          <h2 className="portfolio-title">Portfolio</h2>
          <div className="portfolio-title-actions">
            <span className="portfolio-count">
              {properties.length}
              {properties.length !== totalCount && (
                <span className="portfolio-count-total"> / {totalCount}</span>
              )}
            </span>
            <button
              type="button"
              className="portfolio-add"
              onClick={onAddProperty}
            >
              + Add property
            </button>
          </div>
        </div>

        <div className="filters-toolbar">
          <button
            type="button"
            className={`filters-toggle${isFiltersOpen ? ' is-open' : ''}`}
            onClick={() => setIsFiltersOpen((v) => !v)}
            aria-expanded={isFiltersOpen}
            aria-controls="filters-panel"
          >
            <span className="filters-toggle-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 5 H20 M7 12 H17 M10 19 H14"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="filters-toggle-label">Filters</span>
            {activeCount > 0 && (
              <span className="filters-toggle-count">{activeCount}</span>
            )}
            <span className="filters-toggle-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 9 L12 15 L18 9"
                  stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          {activeCount > 0 && (
            <button
              type="button"
              className="filters-clear"
              onClick={onFiltersReset}
            >
              Clear
            </button>
          )}
        </div>

        <div
          id="filters-panel"
          className={`filters-panel${isFiltersOpen ? ' is-open' : ''}`}
        >
          <Filters filters={filters} onChange={onFiltersChange} options={options} />
        </div>

        <div className="sort-toolbar">
          <label className="sort-label" htmlFor="portfolio-sort">
            <span className="sort-label-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M7 5 V19 M7 5 L3 9 M7 5 L11 9
                         M17 19 V5 M17 19 L13 15 M17 19 L21 15"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sort-label-text">Sort by</span>
          </label>
          <div className="sort-select-wrap">
            <select
              id="portfolio-sort"
              className="sort-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              aria-label={`Sort portfolio — currently ${sortLabel}`}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="sort-select-chevron" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 9 L12 15 L18 9"
                  stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
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

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [51.475, -0.18],
      zoom: 12,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();

    properties.forEach((p) => {
      const hasAlerts = p.alertTags && p.alertTags.length > 0;
      const isSelected = p.id === selectedId;

      const tagList = hasAlerts
        ? `<div class="map-popup-alerts">${p.alertTags
            .map((t) => `<span class="alert-tag">${t}</span>`)
            .join('')}</div>`
        : '';

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: isSelected ? 10 : 8,
        color: '#b91c1c',
        weight: isSelected ? 2 : 1.5,
        opacity: 0.75,
        fillColor: '#dc2626',
        fillOpacity: 0.35,
      })
        .addTo(map)
        .bindPopup(
          `<div class="map-popup-title">${p.address}</div>
           <div class="map-popup-sub">${p.city} · ${p.postcode}</div>
           ${tagList}
           <div class="map-popup-meta">
             <span>Signal: <strong>${p.signalType}</strong></span>
             <span>Severity: <strong>${p.severity}</strong></span>
             <span>Status: <strong>${p.workflowStatus}</strong></span>
           </div>`
        )
        .on('click', () => onSelect(p.id));

      markersRef.current.set(p.id, marker);

      if (hasAlerts) {
        const alertCore = L.circleMarker([p.lat, p.lng], {
          radius: isSelected ? 3.5 : 3,
          color: '#111111',
          weight: 1,
          opacity: 0.95,
          fillColor: '#111111',
          fillOpacity: 0.95,
          interactive: false,
        }).addTo(map);
        markersRef.current.set(`${p.id}__core`, alertCore);
      }
    });

    if (properties.length) {
      const latLngs = properties.map((p) => [p.lat, p.lng]);
      map.fitBounds(latLngs, { padding: [40, 40], maxZoom: 14, animate: false });
    }
  }, [properties, selectedId, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const p = properties.find((x) => x.id === selectedId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [selectedId]);

  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 50);
    }
  }, [visible]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" />

      <div className="map-legend">
        <span className="legend-title">Markers</span>
        <span className="legend-item"><i className="legend-dot-red" />Property</span>
        <span className="legend-divider" />
        <span className="legend-item"><i className="legend-dot-alert" />Has alert tag</span>
      </div>
    </div>
  );
}

/* ---------- DetailsView ---------- */

function Stat({ label, value, custom }) {
  return (
    <div className={`stat${custom ? ' stat-custom' : ''}`}>
      <div className="stat-label">
        {label}
        {custom && <span className="filter-hint">Custom</span>}
      </div>
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
  const signalPill = property.alertTags && property.alertTags.length > 0
    ? property.alertTags[0]
    : null;

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
          {signalPill && <span className="signal-type">{signalPill}</span>}
          <span className={SEVERITY_CLASS[property.severity]}>{property.severity}</span>
          <span className={STATUS_CLASS[property.workflowStatus] || 'pill'}>
            {property.workflowStatus}
          </span>
        </div>
      </header>

      {property.alertTags && property.alertTags.length > 0 && (
        <section className="details-card details-card-alerts">
          <h3 className="details-card-title">
            <span className="alerts-title-icon"><AlertIcon /></span>
            Active alerts
            <span className="alerts-count">{property.alertTags.length}</span>
          </h3>
          <AlertTags tags={property.alertTags} />
          <p className="details-notes details-alerts-note">
            Triggered by recent signals affecting this property. Review the
            intelligence notes below for context.
          </p>
        </section>
      )}

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
          <Stat label="Assigned to" value={property.assignedTo} />
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

      <section className="details-card details-card-custom">
        <h3 className="details-card-title">
          Client-configured fields
          <span className="filter-group-tag">Custom</span>
        </h3>
        <div className="details-grid">
          <Stat label="Tenure" value={property.tenure} custom />
          <Stat label="EPC rating" value={property.epc} custom />
          <Stat
            label="Unlicensed HMO"
            value={property.isUnlicensedHmo ? 'Yes' : 'No'}
            custom
          />
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

const DEFAULT_FILTERS = {
  postcode: 'All',
  propertyType: 'All',
  signalType: 'All',
  severity: 'All',
  dateAdded: 'all',
  workflowStatus: 'All',
  assignedTo: 'All',
  tenure: 'All',
  epc: 'All',
  hmo: 'All',
  summaryTag: 'All',
};

function applyFilters(items, filters) {
  const now = new Date();
  return items.filter((p) => {
    if (filters.postcode !== 'All' && outwardCode(p.postcode) !== filters.postcode) return false;
    if (filters.propertyType !== 'All' && p.type !== filters.propertyType) return false;
    if (filters.signalType !== 'All' && p.signalType !== filters.signalType) return false;
    if (filters.severity !== 'All' && p.severity !== filters.severity) return false;
    if (filters.workflowStatus !== 'All' && p.workflowStatus !== filters.workflowStatus) return false;
    if (filters.assignedTo !== 'All' && p.assignedTo !== filters.assignedTo) return false;
    if (filters.tenure !== 'All' && p.tenure !== filters.tenure) return false;
    if (filters.epc !== 'All' && p.epc !== filters.epc) return false;

    if (filters.hmo === 'yes' && !p.isUnlicensedHmo) return false;
    if (filters.hmo === 'no' && p.isUnlicensedHmo) return false;
    if (filters.summaryTag !== 'All' && p.pillTag !== filters.summaryTag) return false;

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
  const [all, setAll] = useState(() => (window.PROPERTIES || []));
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState('date-desc');
  const [selectedId, setSelectedId] = useState(all[0] ? all[0].id : null);
  const [activeTab, setActiveTab] = useState('map');
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [newPostcode, setNewPostcode] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const options = useMemo(
    () => ({
      postcodes: uniqueSorted(all.map((p) => outwardCode(p.postcode))),
      propertyTypes: uniqueSorted(all.map((p) => p.type)),
      signalTypes: window.SIGNAL_TYPES || uniqueSorted(all.map((p) => p.signalType)),
      severities: window.SEVERITY_LEVELS || ['Low', 'Medium', 'High', 'Critical'],
      workflowStatuses: window.WORKFLOW_STATUSES || uniqueSorted(all.map((p) => p.workflowStatus)),
      owners: window.OWNERS || uniqueSorted(all.map((p) => p.assignedTo)),
      tenures: window.TENURES || uniqueSorted(all.map((p) => p.tenure)),
      epcs: window.EPC_RATINGS || uniqueSorted(all.map((p) => p.epc)),
    }),
    [all]
  );

  const filtered = useMemo(
    () => sortProperties(applyFilters(all, filters), sortBy),
    [all, filters, sortBy]
  );
  const selectedProperty = useMemo(
    () => all.find((p) => p.id === selectedId) || null,
    [all, selectedId]
  );
  const summaryCounts = useMemo(() => {
    const counts = {};
    SUMMARY_TAG_ORDER.forEach((tag) => { counts[tag] = 0; });
    all.forEach((p) => {
      if (p.pillTag && counts[p.pillTag] !== undefined) counts[p.pillTag] += 1;
    });
    return counts;
  }, [all]);
  const taggedTotal = useMemo(
    () => all.filter((p) => SUMMARY_TAG_ORDER.includes(p.pillTag)).length,
    [all]
  );
  const newAddressOptions = useMemo(
    () => makeAddressOptions(newPostcode),
    [newPostcode]
  );
  const toggleSummaryTag = (tag) => {
    setFilters((prev) => ({
      ...prev,
      summaryTag: prev.summaryTag === tag ? 'All' : tag,
    }));
  };
  const openAddProperty = () => {
    setIsAddPropertyOpen(true);
    setNewPostcode('');
    setNewAddress('');
  };
  const closeAddProperty = () => {
    setIsAddPropertyOpen(false);
    setNewPostcode('');
    setNewAddress('');
  };
  const submitAddProperty = () => {
    if (!newPostcode.trim() || !newAddress) return;
    const newProperty = createNewProperty(
      { postcode: newPostcode, address: newAddress },
      all
    );
    setAll((prev) => [newProperty, ...prev]);
    setSelectedId(newProperty.id);
    setActiveTab('details');
    closeAddProperty();
  };

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
            <p className="app-subtitle">Monitor signals across your property portfolio</p>
          </div>
        </div>
      </header>

      <SummaryBar
        counts={summaryCounts}
        taggedTotal={taggedTotal}
        activeTag={filters.summaryTag}
        onTagToggle={toggleSummaryTag}
      />

      <main className="app-main">
        <Portfolio
          properties={filtered}
          totalCount={all.length}
          filters={filters}
          onFiltersChange={setFilters}
          onFiltersReset={() => setFilters(DEFAULT_FILTERS)}
          sortBy={sortBy}
          onSortChange={setSortBy}
          options={options}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddProperty={openAddProperty}
        />

        <section className="workspace">
          <div className="tabs" role="tablist" aria-label="Workspace view">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'map'}
              className={`tab${activeTab === 'map' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <span className="tab-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 3 L3 5 V21 L9 19 L15 21 L21 19 V3 L15 5 Z"
                    stroke="currentColor" strokeWidth="1.8"
                    strokeLinejoin="round" fill="none"
                  />
                  <path d="M9 3 V19 M15 5 V21"
                    stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
              <span className="tab-label">Map view</span>
              <span className="tab-count">{filtered.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'details'}
              className={`tab${activeTab === 'details' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              <span className="tab-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="3" width="16" height="18" rx="2"
                    stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 8 H16 M8 12 H16 M8 16 H13"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="tab-label">Property details</span>
              {selectedProperty && (
                <span className="tab-hint">{selectedProperty.address}</span>
              )}
            </button>
          </div>

          <div className="tab-panel">
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

      {isAddPropertyOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeAddProperty}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Add property" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add new property</h2>
              <button type="button" className="modal-close" onClick={closeAddProperty} aria-label="Close">
                ×
              </button>
            </div>
            <p className="modal-subtitle">
              Enter postcode and select an address to add this property to the portfolio.
            </p>
            <div className="modal-fields">
              <label className="modal-field">
                <span>Postcode</span>
                <input
                  type="text"
                  placeholder="e.g. SW11 3AA"
                  value={newPostcode}
                  onChange={(e) => {
                    setNewPostcode(e.target.value.toUpperCase());
                    setNewAddress('');
                  }}
                />
              </label>
              <label className="modal-field">
                <span>Address</span>
                <select
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  disabled={!newPostcode.trim()}
                >
                  <option value="">Select address</option>
                  {newAddressOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeAddProperty}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitAddProperty}
                disabled={!newPostcode.trim() || !newAddress}
              >
                Add property
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
