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

const OWNER_CONTACTS = {
  'Sarah Lee': { email: 'sarah.lee@portfolio-ops.co.uk', phone: '+442079460101' },
  'Tom Harris': { email: 'tom.harris@portfolio-ops.co.uk', phone: '+442079460102' },
  'Priya Patel': { email: 'priya.patel@portfolio-ops.co.uk', phone: '+442079460103' },
  'James Whitcombe': { email: 'james.whitcombe@portfolio-ops.co.uk', phone: '+442079460104' },
  'Risk Team': { email: 'risk.team@portfolio-ops.co.uk', phone: '+442079460105' },
  'Unassigned': { email: 'portfolio.ops@portfolio-ops.co.uk', phone: '+442079460100' },
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

function datasetValueFor(property, dataset) {
  const isAlert = property.pillTag === dataset
    || (property.alertTags && property.alertTags.includes(dataset));

  if (dataset === 'Flood/Subsidence Risk') {
    if (property.floodRisk) return `${property.floodRisk}${isAlert ? ' alert' : ''}`;
    return isAlert ? 'Alert' : 'N/A';
  }
  if (dataset === 'Crime spikes') {
    return isAlert ? `${property.severity} alert` : 'No alert';
  }
  if (dataset === 'Environmental risk') {
    return isAlert ? `${property.severity} alert` : 'No alert';
  }
  if (dataset === 'EPC Rating') {
    if (!property.epc) return 'N/A';
    return `Band ${property.epc}${isAlert ? ' alert' : ''}`;
  }
  if (dataset === 'Listed building') {
    return isAlert ? 'Flagged' : 'No';
  }
  if (dataset === 'Non-standard construction') {
    if (isAlert) return 'Flagged';
    return property.type === 'Mixed Use' ? 'Possible' : 'No';
  }
  return 'N/A';
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
const FLOOD_RISK_RANK = { Low: 1, Medium: 2, High: 3 };
const EPC_RISK_RANK = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };
const SUMMARY_TAG_ORDER = [
  'Flood/Subsidence Risk',
  'Crime spikes',
  'Environmental risk',
  'EPC Rating',
  'Listed building',
  'Non-standard construction',
];
const DATASET_SORT_OPTIONS = [
  { value: 'None', label: 'None (off)' },
  ...SUMMARY_TAG_ORDER.map((tag) => ({ value: tag, label: tag })),
];
const DATASET_SORT_DIRECTION_OPTIONS = [
  { value: 'desc', label: 'High to Low' },
  { value: 'asc', label: 'Low to High' },
];
const PORTFOLIO_PAGE_SIZE = 20;
const CLAPHAM_JUNCTION_CENTER = [51.4652, -0.1707];
const SUMMARY_CHART_COLORS = ['#2563eb', '#dc2626', '#059669', '#f59e0b', '#7c3aed', '#0891b2'];
const ADDRESS_STEM_OPTIONS = [
  'Station Road',
  'High Street',
  'Church Lane',
  'Park Avenue',
  'Victoria Road',
];

function SummaryTagIcon({ tag }) {
  const base = { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' };
  if (tag === 'Flood/Subsidence Risk') {
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
  if (tag === 'Listed building') {
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
    pillTag: null,
    alertTags: [],
  };
}

function datasetSortScore(property, datasetTag) {
  const hasDatasetAlert = property.pillTag === datasetTag
    || (property.alertTags && property.alertTags.includes(datasetTag));

  if (datasetTag === 'Flood/Subsidence Risk') {
    return (FLOOD_RISK_RANK[property.floodRisk] || 0) + (hasDatasetAlert ? 4 : 0);
  }
  if (datasetTag === 'EPC Rating') {
    return EPC_RISK_RANK[property.epc] || 0;
  }
  if (
    datasetTag === 'Crime spikes'
    || datasetTag === 'Environmental risk'
    || datasetTag === 'Listed building'
    || datasetTag === 'Non-standard construction'
  ) {
    return hasDatasetAlert ? (SEVERITY_RANK[property.severity] || 0) + 4 : 0;
  }
  return 0;
}

function primarySortComparator(a, b, sortBy) {
  if (sortBy === 'date-asc') {
    return a.dateAdded.localeCompare(b.dateAdded);
  }
  if (sortBy === 'alert-desc') {
    const aTagged = (a.alertTags && a.alertTags.length > 0) ? 1 : 0;
    const bTagged = (b.alertTags && b.alertTags.length > 0) ? 1 : 0;
    if (aTagged !== bTagged) return bTagged - aTagged;
    const sev = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
    if (sev !== 0) return sev;
    return b.dateAdded.localeCompare(a.dateAdded);
  }
  return b.dateAdded.localeCompare(a.dateAdded);
}

function sortProperties(items, sortBy, datasetSortTag, datasetSortDirection) {
  const copy = items.slice();
  copy.sort((a, b) => {
    if (datasetSortTag && datasetSortTag !== 'None') {
      const scoreDiff = datasetSortScore(b, datasetSortTag) - datasetSortScore(a, datasetSortTag);
      const datasetDiff = datasetSortDirection === 'asc' ? -scoreDiff : scoreDiff;
      if (datasetDiff !== 0) return datasetDiff;
    }
    return primarySortComparator(a, b, sortBy);
  });
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

function WorkflowStatusIcon({ status }) {
  if (status === 'Action required') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 L22 20 H2 Z" fill="currentColor" />
        <path d="M12 9 V14" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.2" fill="white" />
      </svg>
    );
  }
  if (status === 'Resolved') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M7 12.5 L10.2 15.5 L17 8.8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'In review') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
        <path d="M8 12 H16 M8 8 H16 M8 16 H13" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'Awaiting customer') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M12 7 V12 L15.5 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'Snoozed') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M9.5 8 H15.5 L10.5 16 H15.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 7 V17 M7 12 H17" stroke="white" strokeWidth="2" strokeLinecap="round" />
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
  const hasAlertType = Boolean(property.pillTag);
  const severityTone = property.severity === 'Medium'
    ? 'medium'
    : (property.severity === 'High' || property.severity === 'Critical' ? 'high' : 'low');
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
        {hasAlertType && (
          <div className="property-card-alert-row">
            <span className={`signal-type signal-type-${severityTone}`}>{property.pillTag}</span>
            <span className="property-card-alert-date">
              Alert date {formatDate(property.dateAdded)}
            </span>
          </div>
        )}
        <table className="property-card-dataset-table" aria-label="Dataset values">
          <tbody>
            {SUMMARY_TAG_ORDER.map((dataset) => {
              const isAlert = property.pillTag === dataset
                || (property.alertTags && property.alertTags.includes(dataset));
              return (
                <tr key={dataset} className={isAlert ? 'is-alert' : ''}>
                  <th scope="row">{dataset}</th>
                  <td>{datasetValueFor(property, dataset)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <span className="property-card-meta">
          <span className="property-meta-item">
            <span className="property-meta-label">Workflow status:</span>
            <span className={`property-meta-status status-${property.workflowStatus.toLowerCase().replace(/\s+/g, '-')}`}>
              <WorkflowStatusIcon status={property.workflowStatus} />
              {property.workflowStatus}
            </span>
          </span>
          <span className="property-meta-item">
            <span className="property-meta-label">Assigned owner:</span>
            <span>{property.assignedTo}</span>
          </span>
        </span>
      </div>
    </button>
  );
}

/* ---------- Portfolio (left pane) ---------- */

function countActiveFilters(filters) {
  return Object.values(filters).filter((v) => v !== 'All' && v !== 'all').length;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function serializePortfolioRows(items) {
  return items.map((p) => ({
    id: p.id,
    address: p.address,
    city: p.city,
    postcode: p.postcode,
    alertType: p.pillTag || '',
    severity: p.severity,
    signalType: p.signalType,
    dateAdded: p.dateAdded,
    workflowStatus: p.workflowStatus,
    assignedOwner: p.assignedTo,
    propertyType: p.type,
    estimatedValue: p.estimatedValue,
    epc: p.epc,
    floodRisk: p.floodRisk,
  }));
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.map(esc).join(','),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(',')),
  ];
  return `\ufeff${lines.join('\n')}`;
}

function toTsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v) => String(v ?? '').replace(/\t/g, ' ');
  const lines = [
    headers.map(esc).join('\t'),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join('\t')),
  ];
  return lines.join('\n');
}

function Portfolio({
  properties, totalCount, filters, onFiltersChange, onFiltersReset,
  sortBy, onSortChange, datasetSortTag, onDatasetSortTagChange,
  datasetSortDirection, onDatasetSortDirectionChange,
  options, selectedId, onSelect, onAddProperty,
}) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const activeCount = countActiveFilters(filters);
  const sortLabel =
    (SORT_OPTIONS.find((o) => o.value === sortBy) || SORT_OPTIONS[0]).label;
  const totalPages = Math.max(1, Math.ceil(properties.length / PORTFOLIO_PAGE_SIZE));
  const startIdx = (currentPage - 1) * PORTFOLIO_PAGE_SIZE;
  const pagedProperties = properties.slice(startIdx, startIdx + PORTFOLIO_PAGE_SIZE);
  const showingFrom = properties.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + PORTFOLIO_PAGE_SIZE, properties.length);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectedId || properties.length === 0) return;
    const idx = properties.findIndex((p) => p.id === selectedId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / PORTFOLIO_PAGE_SIZE) + 1;
    if (targetPage !== currentPage) setCurrentPage(targetPage);
  }, [selectedId, properties, currentPage]);

  const exportRows = useMemo(() => serializePortfolioRows(properties), [properties]);
  const exportCsv = () => downloadFile(toCsv(exportRows), 'portfolio-export.csv', 'text/csv;charset=utf-8');
  const exportExcel = () => downloadFile(toTsv(exportRows), 'portfolio-export.xls', 'application/vnd.ms-excel;charset=utf-8');
  const exportJson = () => downloadFile(JSON.stringify(exportRows, null, 2), 'portfolio-export.json', 'application/json;charset=utf-8');

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

        <div className="sort-toolbar dataset-sort-toolbar">
          <label className="sort-label" htmlFor="portfolio-dataset-sort">
            <span className="sort-label-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 12 H20 M4 7 H16 M4 17 H13"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="sort-label-text">Sort dataset</span>
          </label>
          <div className="sort-select-wrap">
            <select
              id="portfolio-dataset-sort"
              className="sort-select"
              value={datasetSortTag}
              onChange={(e) => onDatasetSortTagChange(e.target.value)}
              aria-label="Sort portfolio by dataset, high to low"
            >
              {DATASET_SORT_OPTIONS.map((o) => (
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
          <label className="sort-label" htmlFor="portfolio-dataset-sort-direction">
            <span className="sort-label-text">Method</span>
          </label>
          <div className="sort-select-wrap">
            <select
              id="portfolio-dataset-sort-direction"
              className="sort-select"
              value={datasetSortDirection}
              onChange={(e) => onDatasetSortDirectionChange(e.target.value)}
              aria-label="Dataset sort method"
            >
              {DATASET_SORT_DIRECTION_OPTIONS.map((o) => (
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
          pagedProperties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              selected={p.id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
      <div className="portfolio-footer">
        <div className="portfolio-footer-title">
          <span>Pagination & Export</span>
          <span className="portfolio-footer-range">Showing {showingFrom}-{showingTo} of {properties.length}</span>
        </div>
        <div className="portfolio-pagination">
          <button
            type="button"
            className="page-btn"
            onClick={() => setCurrentPage((v) => Math.max(1, v - 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          <span className="page-info">Page {currentPage} / {totalPages}</span>
          <button
            type="button"
            className="page-btn"
            onClick={() => setCurrentPage((v) => Math.min(totalPages, v + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
        <div className="portfolio-export">
          <button type="button" className="export-btn" onClick={exportCsv}>CSV</button>
          <button type="button" className="export-btn" onClick={exportExcel}>Excel</button>
          <button type="button" className="export-btn" onClick={exportJson}>JSON</button>
        </div>
      </div>
    </aside>
  );
}

/* ---------- MapView (Leaflet, plain) ---------- */

function MapView({ properties, selectedId, onSelect, visible }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const heatLayerRef = useRef(null);
  const hasHandledInitialSelectedRef = useRef(false);
  const [mapMode, setMapMode] = useState('points');

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: CLAPHAM_JUNCTION_CENTER,
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
      heatLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();

    if (mapMode === 'heat' && L.heatLayer) {
      const heatPoints = properties.map((p) => {
        const base = (SEVERITY_RANK[p.severity] || 1) / 4;
        const tagBoost = p.alertTags && p.alertTags.length > 0 ? 0.2 : 0;
        return [p.lat, p.lng, Math.min(1, base + tagBoost)];
      });
      heatLayerRef.current = L.heatLayer(heatPoints, {
        radius: 28,
        blur: 22,
        maxZoom: 16,
        minOpacity: 0.35,
        gradient: {
          0.2: '#93c5fd',
          0.4: '#60a5fa',
          0.6: '#f59e0b',
          0.8: '#f97316',
          1.0: '#dc2626',
        },
      }).addTo(map);
    } else {
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
    }

  }, [properties, selectedId, onSelect, mapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || mapMode !== 'points') return;
    if (!hasHandledInitialSelectedRef.current) {
      hasHandledInitialSelectedRef.current = true;
      return;
    }
    const p = properties.find((x) => x.id === selectedId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [selectedId, mapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || mapMode !== 'heat') return;
    if (!hasHandledInitialSelectedRef.current) {
      hasHandledInitialSelectedRef.current = true;
      return;
    }
    const p = properties.find((x) => x.id === selectedId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [selectedId, mapMode, properties]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || (mapMode !== 'heat' && mapMode !== 'points')) return;
    map.setView(CLAPHAM_JUNCTION_CENTER, 12, { animate: false });
  }, [mapMode]);

  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 50);
    }
  }, [visible]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" />

      <div className="map-mode-toggle" role="group" aria-label="Map display mode">
        <button
          type="button"
          className={`map-mode-btn${mapMode === 'points' ? ' is-active' : ''}`}
          onClick={() => setMapMode('points')}
        >
          Point markers
        </button>
        <button
          type="button"
          className={`map-mode-btn${mapMode === 'heat' ? ' is-active' : ''}`}
          onClick={() => setMapMode('heat')}
        >
          Heat map
        </button>
      </div>

      <div className="map-legend">
        <span className="legend-title">{mapMode === 'heat' ? 'Heat intensity' : 'Markers'}</span>
        {mapMode === 'heat' ? (
          <>
            <span className="legend-item"><i className="legend-heat-low" />Lower intensity</span>
            <span className="legend-item"><i className="legend-heat-high" />Higher intensity</span>
          </>
        ) : (
          <>
            <span className="legend-item"><i className="legend-dot-red" />Property</span>
            <span className="legend-divider" />
            <span className="legend-item"><i className="legend-dot-alert" />Has alert tag</span>
          </>
        )}
      </div>
    </div>
  );
}

function ChartsView({ properties }) {
  const [selectedChart, setSelectedChart] = useState('alert-breakdown');
  const [visibleSignalTypes, setVisibleSignalTypes] = useState([]);

  const chartData = useMemo(() => {
    const counts = {};
    SUMMARY_TAG_ORDER.forEach((tag) => { counts[tag] = 0; });
    let otherCount = 0;

    properties.forEach((p) => {
      if (counts[p.pillTag] !== undefined) {
        counts[p.pillTag] += 1;
      } else {
        otherCount += 1;
      }
    });

    const entries = SUMMARY_TAG_ORDER.map((tag, idx) => ({
      label: tag,
      value: counts[tag],
      color: SUMMARY_CHART_COLORS[idx],
    }));

    entries.push({
      label: 'No alert / New',
      value: otherCount,
      color: '#cbd5e1',
    });

    return entries;
  }, [properties]);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const pieGradient = useMemo(() => {
    if (!total) return '#e5e7eb';
    let start = 0;
    const stops = chartData
      .filter((item) => item.value > 0)
      .map((item) => {
        const span = (item.value / total) * 360;
        const stop = `${item.color} ${start}deg ${start + span}deg`;
        start += span;
        return stop;
      });
    return `conic-gradient(${stops.join(', ')})`;
  }, [chartData, total]);

  const signalTrend = useMemo(() => {
    const signalTypes = SUMMARY_TAG_ORDER.slice();
    if (signalTypes.length === 0) {
      return {
        labels: [],
        series: [],
        maxY: 0,
      };
    }

    const dates = properties
      .map((p) => new Date(p.dateAdded))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b);

    if (!dates.length) {
      return {
        labels: [],
        series: signalTypes.map((s, idx) => ({
          label: s,
          color: SUMMARY_CHART_COLORS[idx % SUMMARY_CHART_COLORS.length],
          values: [],
        })),
        maxY: 0,
      };
    }

    const first = new Date(dates[0].getFullYear(), dates[0].getMonth(), 1);
    const last = new Date(dates[dates.length - 1].getFullYear(), dates[dates.length - 1].getMonth(), 1);
    const monthKeys = [];
    const monthLabels = [];
    const cursor = new Date(first);
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      monthLabels.push(cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const countsByType = {};
    signalTypes.forEach((signalType) => {
      countsByType[signalType] = {};
      monthKeys.forEach((monthKey) => {
        countsByType[signalType][monthKey] = 0;
      });
    });

    properties.forEach((p) => {
      const d = new Date(p.dateAdded);
      if (Number.isNaN(d.getTime())) return;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const alertType = SUMMARY_TAG_ORDER.includes(p.pillTag) ? p.pillTag : null;
      if (alertType && countsByType[alertType] && countsByType[alertType][monthKey] !== undefined) {
        countsByType[alertType][monthKey] += 1;
      }
    });

    const series = signalTypes.map((signalType, idx) => ({
      label: signalType,
      color: SUMMARY_CHART_COLORS[idx % SUMMARY_CHART_COLORS.length],
      values: monthKeys.map((monthKey) => countsByType[signalType][monthKey]),
    }));

    const maxY = Math.max(
      1,
      ...series.flatMap((s) => s.values)
    );

    return {
      labels: monthLabels,
      series,
      maxY,
    };
  }, [properties]);

  useEffect(() => {
    const labels = signalTrend.series.map((series) => series.label);
    setVisibleSignalTypes((prev) => {
      const retained = prev.filter((label) => labels.includes(label));
      if (retained.length === 0 && labels.length > 0) return labels;
      if (retained.length !== prev.length) return retained;
      return prev;
    });
  }, [signalTrend.series]);

  const visibleTrendSeries = useMemo(
    () => signalTrend.series.filter((series) => visibleSignalTypes.includes(series.label)),
    [signalTrend.series, visibleSignalTypes]
  );

  const visibleTrendMaxY = useMemo(
    () => Math.max(1, ...visibleTrendSeries.flatMap((series) => series.values)),
    [visibleTrendSeries]
  );

  const toggleSignalType = (label) => {
    setVisibleSignalTypes((prev) => (
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    ));
  };

  return (
    <div className="charts-view">
      <div className="charts-toolbar">
        <label className="filter">
          <span className="filter-label">Chart</span>
          <select value={selectedChart} onChange={(e) => setSelectedChart(e.target.value)}>
            <option value="alert-breakdown">Portfolio by alert type</option>
            <option value="signal-trend">Alert type change over time</option>
          </select>
        </label>
      </div>

      {selectedChart === 'alert-breakdown' && (
        <section className="chart-card">
          <header className="chart-card-header">
            <h3>Portfolio breakdown by alert type</h3>
            <span>{total} properties</span>
          </header>
          <div className="chart-card-body">
            <div
              className="pie-chart"
              style={{ background: pieGradient }}
              role="img"
              aria-label="Pie chart showing portfolio breakdown by alert type"
            />
            <div className="pie-legend">
              {chartData.map((item) => {
                const pct = total ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.label} className="pie-legend-item">
                    <span className="pie-legend-swatch" style={{ background: item.color }} />
                    <span className="pie-legend-label">{item.label}</span>
                    <span className="pie-legend-value">{item.value} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {selectedChart === 'signal-trend' && (
        <section className="chart-card">
          <header className="chart-card-header">
            <h3>Alert type change over time</h3>
            <span>{signalTrend.labels.length} time periods</span>
          </header>
          <div className="chart-card-body chart-card-body-line">
            {signalTrend.labels.length === 0 ? (
              <div className="chart-empty">No dated signal data available.</div>
            ) : (
              <svg
                className="line-chart"
                viewBox="0 0 1100 560"
                role="img"
                aria-label="Line chart showing signal type totals over time"
              >
                <rect x="0" y="0" width="1100" height="560" fill="white" />
                <line x1="80" y1="40" x2="80" y2="460" stroke="#cfd6dd" />
                <line x1="80" y1="460" x2="1040" y2="460" stroke="#cfd6dd" />

                {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                  const y = 460 - (420 * step);
                  const value = Math.round(visibleTrendMaxY * step);
                  return (
                    <g key={`y-${step}`}>
                      <line x1="80" y1={y} x2="1040" y2={y} stroke="#eef2f6" />
                      <text x="68" y={y + 5} textAnchor="end" fontSize="15" fill="#6e7981">{value}</text>
                    </g>
                  );
                })}

                {signalTrend.labels.map((label, idx) => {
                  const x = 80 + ((960 * idx) / Math.max(signalTrend.labels.length - 1, 1));
                  return (
                    <text
                      key={label}
                      x={x}
                      y="488"
                      textAnchor={idx === 0 ? 'start' : idx === signalTrend.labels.length - 1 ? 'end' : 'middle'}
                      fontSize="15"
                      fill="#6e7981"
                    >
                      {label}
                    </text>
                  );
                })}

                {visibleTrendSeries.map((series) => {
                  const points = series.values.map((value, idx) => {
                    const x = 80 + ((960 * idx) / Math.max(series.values.length - 1, 1));
                    const y = 460 - ((value / visibleTrendMaxY) * 420);
                    return { x, y };
                  });

                  const path = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');

                  return (
                    <g key={series.label}>
                      <path d={path} fill="none" stroke={series.color} strokeWidth="4.8" />
                      {points.map((pt, idx) => (
                        <circle key={`${series.label}-${idx}`} cx={pt.x} cy={pt.y} r="5" fill={series.color} />
                      ))}
                    </g>
                  );
                })}
              </svg>
            )}

            <div className="line-legend">
              {signalTrend.series.map((series) => (
                <button
                  key={series.label}
                  type="button"
                  className={`line-legend-item${visibleSignalTypes.includes(series.label) ? '' : ' is-inactive'}`}
                  onClick={() => toggleSignalType(series.label)}
                  aria-pressed={visibleSignalTypes.includes(series.label)}
                >
                  <span className="line-legend-swatch" style={{ background: series.color }} />
                  <span className="line-legend-label">{series.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PropertyMiniMap({ property }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [property.lat, property.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      touchZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [property.lat, property.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const latLng = [property.lat, property.lng];
    map.setView(latLng, 16, { animate: false });
    if (markerRef.current) map.removeLayer(markerRef.current);
    markerRef.current = L.circleMarker(latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: '#dc2626',
      fillOpacity: 0.8,
    }).addTo(map);
  }, [property.lat, property.lng]);

  return <div ref={containerRef} className="details-mini-map" />;
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

  const detailsTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'recommended', label: 'Recommended Actions' },
    { id: 'workflow', label: 'Workflow Actions' },
    { id: 'history', label: 'Property History' },
    { id: 'timeline', label: 'Timeline/Activity Log' },
  ];
  const [detailsTab, setDetailsTab] = useState('overview');
  const [workflowStatusDraft, setWorkflowStatusDraft] = useState(
    property.workflowStatus === 'Resolved' ? 'Complete' : (property.workflowStatus === 'In review' ? 'Investigating' : 'New')
  );
  const [assigneeDraft, setAssigneeDraft] = useState(property.assignedTo);
  const [workflowNoteDraft, setWorkflowNoteDraft] = useState('');

  useEffect(() => {
    setDetailsTab('overview');
    setWorkflowStatusDraft(
      property.workflowStatus === 'Resolved' ? 'Complete' : (property.workflowStatus === 'In review' ? 'Investigating' : 'New')
    );
    setAssigneeDraft(property.assignedTo);
    setWorkflowNoteDraft('');
  }, [property.id, property.workflowStatus, property.assignedTo]);

  const valuationHistory = [
    { period: 'Q1', value: Math.round(property.estimatedValue * 0.93) },
    { period: 'Q2', value: Math.round(property.estimatedValue * 0.95) },
    { period: 'Q3', value: Math.round(property.estimatedValue * 0.97) },
    { period: 'Q4', value: property.estimatedValue },
    { period: 'Current', value: Math.round(property.estimatedValue * 1.01) },
  ];
  const valuationMax = Math.max(...valuationHistory.map((p) => p.value));
  const valuationPath = valuationHistory.map((point, idx) => {
    const x = 30 + ((320 * idx) / Math.max(valuationHistory.length - 1, 1));
    const y = 160 - ((point.value / valuationMax) * 130);
    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const activityLog = [
    { date: formatDate(property.dateAdded), text: `Signal generated: ${property.signalType}` },
    { date: formatDate(property.dateAdded), text: `Status changed to ${property.workflowStatus}` },
    { date: formatDate(property.lastValuation), text: `Valuation updated: ${formatGBP(property.estimatedValue)}` },
    { date: formatDate(property.lastValuation), text: `User note added: ${property.notes.slice(0, 64)}...` },
    { date: formatDate(new Date().toISOString().slice(0, 10)), text: 'Export triggered: property details dossier' },
  ];
  const recommendations = [
    {
      action: 'Request updated quote package',
      reason: `Severity is ${property.severity} with workflow currently ${property.workflowStatus}.`,
      pathway: 'Broker quote request -> compare options -> assign approval action',
      outcome: 'Risk mitigation and improved premium positioning',
    },
    {
      action: 'Run owner outreach workflow',
      reason: `Assigned owner is ${property.assignedTo}; active review is required.`,
      pathway: 'Call owner -> send summary email -> capture response in timeline',
      outcome: 'Revenue opportunity through faster conversion cycle',
    },
    {
      action: 'Compile compliance evidence pack',
      reason: `Primary alert is ${signalPill || 'None'} and asset falls under ongoing monitoring.`,
      pathway: 'Assemble signal history -> attach evidence -> push to enforcement system',
      outcome: 'Compliance enforcement readiness',
    },
  ];

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

      <nav className="details-subnav" aria-label="Property details menu">
        {detailsTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`details-subtab${detailsTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setDetailsTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {detailsTab === 'overview' && (
        <>
          <section className="details-card details-mini-map-card">
            <h3 className="details-card-title">Local map</h3>
            <PropertyMiniMap property={property} />
          </section>

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
        </>
      )}

      {detailsTab === 'history' && (
        <>
          <section className="details-card">
            <h3 className="details-card-title">Valuation history and trend lines</h3>
            <svg viewBox="0 0 380 180" className="details-history-chart" role="img" aria-label="Valuation history">
              <line x1="30" y1="20" x2="30" y2="160" stroke="#cfd6dd" />
              <line x1="30" y1="160" x2="350" y2="160" stroke="#cfd6dd" />
              <path d={valuationPath} fill="none" stroke="#066abe" strokeWidth="3" />
              {valuationHistory.map((point, idx) => {
                const x = 30 + ((320 * idx) / Math.max(valuationHistory.length - 1, 1));
                const y = 160 - ((point.value / valuationMax) * 130);
                return (
                  <g key={point.period}>
                    <circle cx={x} cy={y} r="4" fill="#066abe" />
                    <text x={x} y="174" textAnchor="middle" fontSize="11" fill="#6e7981">{point.period}</text>
                  </g>
                );
              })}
            </svg>
          </section>
          <section className="details-card">
            <h3 className="details-card-title">Attribute / risk history</h3>
            <div className="details-history-grid">
              <div><strong>Attribute changes:</strong> EPC currently {property.epc}; tenure {property.tenure}; internal area stable at {property.sqft.toLocaleString()} sqft.</div>
              <div><strong>Risk/peril changes:</strong> Flood risk level {property.floodRisk}; signal severity {property.severity} with recent monitoring updates.</div>
              <div><strong>Comparable benchmarks:</strong> Estimated value is benchmarked against comparable {property.type} assets in {property.city}.</div>
              <div><strong>Proximity/environmental factors:</strong> Nearby transport, flood exposure and environmental overlays contribute to signal confidence scoring.</div>
              <div><strong>Linked property relationships:</strong> Cross-referenced with nearby assets sharing postcode and ownership assignment patterns.</div>
            </div>
          </section>
        </>
      )}

      {detailsTab === 'timeline' && (
        <section className="details-card">
          <h3 className="details-card-title">Timeline/Activity Log</h3>
          <div className="timeline-list">
            {activityLog.map((entry, idx) => (
              <div key={`${entry.date}-${idx}`} className="timeline-item">
                <span className="timeline-date">{entry.date}</span>
                <span className="timeline-text">{entry.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {detailsTab === 'recommended' && (
        <section className="details-card">
          <h3 className="details-card-title">Recommended Actions</h3>
          <div className="recommendation-list">
            {recommendations.map((rec) => (
              <article key={rec.action} className="recommendation-item">
                <h4>{rec.action}</h4>
                <p><strong>Reason for recommendation:</strong> {rec.reason}</p>
                <p><strong>Suggested workflow pathway:</strong> {rec.pathway}</p>
                <p><strong>Expected outcome:</strong> {rec.outcome}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {detailsTab === 'workflow' && (
        <section className="details-card">
          <h3 className="details-card-title">Workflow Actions</h3>
          <div className="workflow-grid">
            <label className="workflow-field">
              <span>Update workflow status</span>
              <select value={workflowStatusDraft} onChange={(e) => setWorkflowStatusDraft(e.target.value)}>
                <option value="New">New</option>
                <option value="Investigating">Investigating</option>
                <option value="Complete">Complete</option>
              </select>
            </label>
            <label className="workflow-field">
              <span>Assign to user / team</span>
              <select value={assigneeDraft} onChange={(e) => setAssigneeDraft(e.target.value)}>
                {window.OWNERS.map((owner) => (
                  <option key={owner} value={owner}>{owner}</option>
                ))}
              </select>
            </label>
            <label className="workflow-field workflow-field-wide">
              <span>Add notes</span>
              <textarea
                rows={4}
                value={workflowNoteDraft}
                onChange={(e) => setWorkflowNoteDraft(e.target.value)}
                placeholder="Add workflow notes..."
              />
            </label>
            <label className="workflow-field workflow-field-wide">
              <span>Add evidence attachments</span>
              <input type="file" multiple />
            </label>
          </div>
          <div className="workflow-actions-row">
            <button type="button" className="cta-btn cta-btn-primary">Save workflow update</button>
            <button type="button" className="cta-btn cta-btn-secondary" onClick={() => window.print()}>Export dossier to PDF</button>
            <button type="button" className="cta-btn cta-btn-secondary">Push to CRM</button>
            <button type="button" className="cta-btn cta-btn-secondary">Push to underwriting tools</button>
            <button type="button" className="cta-btn cta-btn-secondary">Push to enforcement systems</button>
          </div>
        </section>
      )}
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
  const [sortBy, setSortBy] = useState('alert-desc');
  const [datasetSortTag, setDatasetSortTag] = useState('None');
  const [datasetSortDirection, setDatasetSortDirection] = useState('desc');
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
    () => sortProperties(applyFilters(all, filters), sortBy, datasetSortTag, datasetSortDirection),
    [all, filters, sortBy, datasetSortTag, datasetSortDirection]
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
          datasetSortTag={datasetSortTag}
          onDatasetSortTagChange={setDatasetSortTag}
          datasetSortDirection={datasetSortDirection}
          onDatasetSortDirectionChange={setDatasetSortDirection}
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

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'charts'}
              className={`tab${activeTab === 'charts' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('charts')}
            >
              <span className="tab-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 20 H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M6 18 V12 M12 18 V8 M18 18 V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="tab-label">Charts</span>
              <span className="tab-count">{all.length}</span>
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
            {activeTab === 'charts' && <ChartsView properties={all} />}
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
