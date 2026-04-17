// Mock property portfolio for the Property Intelligence Dashboard.
//
// 100 properties clustered across 20 South-West London neighbourhoods.
// Signal type, severity, flood-risk and HMO-likelihood are biased per
// neighbourhood so the map reveals real spatial patterns when filters
// are applied (e.g. flood-risk along the Thames, underinsurance in prime
// areas, HMOs in dense rental markets).
//
// Generation is deterministic (seeded PRNG) so refreshing the page
// always shows the same dataset.

window.SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

window.SIGNAL_TYPES = [
  'Flood risk change',
  'Underinsurance',
  'Valuation drop',
  'EPC downgrade',
  'Listing detected',
  'Subsidence alert',
  'Tenancy change',
  'Insurance gap',
];

window.WORKFLOW_STATUSES = [
  'New',
  'In review',
  'Action required',
  'Awaiting customer',
  'Resolved',
  'Snoozed',
];

window.OWNERS = [
  'Sarah Lee',
  'Tom Harris',
  'Priya Patel',
  'James Whitcombe',
  'Risk Team',
  'Unassigned',
];

window.TENURES = ['Freehold', 'Leasehold', 'Share of Freehold'];
window.EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

window.ALERT_TAGS = [
  'Flood/subsidence exposure',
  'Crime spike',
  'Environmental risk',
  'EPC Rating',
  'Listed Building',
  'Non-Standard Construction',
];

// Per-neighbourhood pool of plausible alert tags. Picked from when we
// assign tags to the 20 chosen properties, so the tag/area pairing is
// believable on the map.
const TAGS_BY_NEIGHBOURHOOD = {
  'Westminster':       ['Listed Building', 'Crime spike'],
  'Belgravia':         ['Listed Building'],
  'Pimlico':           ['Listed Building', 'EPC Rating'],
  'Chelsea':           ['Listed Building'],
  'Clapham':           ['EPC Rating', 'Crime spike'],
  'Earls Court':       ['Crime spike', 'Non-Standard Construction'],
  'Fulham':            ['Flood/subsidence exposure', 'EPC Rating'],
  'South Kensington':  ['Listed Building'],
  'South Lambeth':     ['Environmental risk', 'Crime spike', 'Non-Standard Construction'],
  'Brixton':           ['Crime spike', 'EPC Rating'],
  'West Brompton':     ['Listed Building', 'EPC Rating'],
  'Battersea':         ['Flood/subsidence exposure', 'Environmental risk'],
  'Balham':            ['EPC Rating', 'Non-Standard Construction'],
  'Barnes':            ['Flood/subsidence exposure', 'Listed Building'],
  'Mortlake':          ['Flood/subsidence exposure'],
  'Putney':            ['Flood/subsidence exposure', 'EPC Rating'],
  'Streatham':         ['Crime spike', 'EPC Rating', 'Non-Standard Construction'],
  'Tooting':           ['Crime spike', 'EPC Rating'],
  'Wandsworth':        ['Flood/subsidence exposure', 'Environmental risk'],
  'Wimbledon':         ['EPC Rating', 'Non-Standard Construction'],
};

/* ---------- seeded PRNG (Mulberry32) ---------- */

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260417);
const rnd = () => rng();
const randInt = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pickWeighted = (entries) => {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
};
const jitter = (val, range) => val + (rnd() * 2 - 1) * range;

/* ---------- date helpers ---------- */

const __today = new Date();
function daysAgo(n) {
  const d = new Date(__today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ---------- street / postcode generation ---------- */

const STREET_NAMES = [
  'Park', 'Church', 'Station', 'Victoria', 'Albert', 'Queens', 'Kings',
  'High', 'Manor', 'Grange', 'Mill', 'Vicarage', 'Bridge', 'Garden',
  'Acacia', 'Elm', 'Oak', 'Maple', 'Cedar', 'Beech', 'Lime',
  'St James', 'St Marys', 'Northcote', 'Westbridge', 'Eaton',
  'Lavender', 'Chesham', 'Cadogan', 'Sloane', 'Onslow', 'Cromwell',
  'Drayton', 'Brompton', 'Cheyne', 'Pavilion', 'Pimlico',
];
const STREET_SUFFIXES = [
  'Road', 'Street', 'Avenue', 'Gardens', 'Crescent', 'Place',
  'Lane', 'Square', 'Mews', 'Walk', 'Court', 'Terrace', 'Hill',
];

const POSTCODE_LETTERS = 'ABDEFGHJLNPQRSTUWXYZ';
function postcodeUnit() {
  return (
    String(randInt(1, 9)) +
    POSTCODE_LETTERS[Math.floor(rnd() * POSTCODE_LETTERS.length)] +
    POSTCODE_LETTERS[Math.floor(rnd() * POSTCODE_LETTERS.length)]
  );
}

function makeAddress() {
  return `${randInt(1, 250)} ${pick(STREET_NAMES)} ${pick(STREET_SUFFIXES)}`;
}

/* ---------- neighbourhood definitions ----------
 *
 * jitterDeg ≈ approximate radius in decimal degrees (~0.005 ≈ 500m)
 * Per-area biases steer the property profile toward realistic patterns.
 */

const NEIGHBOURHOODS = [
  {
    name: 'Westminster',
    postcode: 'SW1A',
    lat: 51.5014, lng: -0.1419, jitterDeg: 0.004,
    types: ['Townhouse', 'Mansion', 'Mixed Use'],
    signals: [['Insurance gap', 3], ['Underinsurance', 3], ['Subsidence alert', 2], ['Listing detected', 1]],
    severities: [['Medium', 1], ['High', 3], ['Critical', 3]],
    floodBias: 0.05,
    hmoBias: 0.02,
    valueRange: [3500000, 18000000],
  },
  {
    name: 'Belgravia',
    postcode: 'SW1X',
    lat: 51.4975, lng: -0.1530, jitterDeg: 0.0035,
    types: ['Mansion', 'Townhouse'],
    signals: [['Underinsurance', 4], ['Insurance gap', 3], ['Listing detected', 1]],
    severities: [['High', 3], ['Critical', 4]],
    floodBias: 0.03,
    hmoBias: 0.0,
    valueRange: [8000000, 45000000],
  },
  {
    name: 'Pimlico',
    postcode: 'SW1V',
    lat: 51.4892, lng: -0.1426, jitterDeg: 0.004,
    types: ['Townhouse', 'Flat', 'Apartment'],
    signals: [['Underinsurance', 2], ['EPC downgrade', 2], ['Listing detected', 2], ['Tenancy change', 1]],
    severities: [['Low', 1], ['Medium', 3], ['High', 2]],
    floodBias: 0.2,
    hmoBias: 0.05,
    valueRange: [900000, 3800000],
  },
  {
    name: 'Chelsea',
    postcode: 'SW3',
    lat: 51.4875, lng: -0.1687, jitterDeg: 0.005,
    types: ['Townhouse', 'Mansion', 'Flat'],
    signals: [['Underinsurance', 3], ['EPC downgrade', 2], ['Insurance gap', 2], ['Listing detected', 1]],
    severities: [['Medium', 2], ['High', 3], ['Critical', 2]],
    floodBias: 0.1,
    hmoBias: 0.02,
    valueRange: [2200000, 14000000],
  },
  {
    name: 'Clapham',
    postcode: 'SW4',
    lat: 51.4622, lng: -0.1380, jitterDeg: 0.006,
    types: ['Townhouse', 'Flat', 'Apartment'],
    signals: [['EPC downgrade', 3], ['Tenancy change', 3], ['Listing detected', 2], ['Subsidence alert', 1]],
    severities: [['Low', 2], ['Medium', 3], ['High', 2]],
    floodBias: 0.08,
    hmoBias: 0.18,
    valueRange: [550000, 1800000],
  },
  {
    name: 'Earls Court',
    postcode: 'SW5',
    lat: 51.4912, lng: -0.1939, jitterDeg: 0.004,
    types: ['Flat', 'Apartment'],
    signals: [['Tenancy change', 4], ['Insurance gap', 2], ['EPC downgrade', 2], ['Listing detected', 1]],
    severities: [['Medium', 3], ['High', 3]],
    floodBias: 0.05,
    hmoBias: 0.42,
    valueRange: [550000, 1600000],
  },
  {
    name: 'Fulham',
    postcode: 'SW6',
    lat: 51.4805, lng: -0.1995, jitterDeg: 0.006,
    types: ['Townhouse', 'Flat', 'Apartment'],
    signals: [['Flood risk change', 3], ['EPC downgrade', 2], ['Underinsurance', 1], ['Tenancy change', 1]],
    severities: [['Medium', 3], ['High', 3]],
    floodBias: 0.55,
    hmoBias: 0.08,
    valueRange: [780000, 4500000],
  },
  {
    name: 'South Kensington',
    postcode: 'SW7',
    lat: 51.4940, lng: -0.1742, jitterDeg: 0.004,
    types: ['Townhouse', 'Mansion', 'Flat'],
    signals: [['Underinsurance', 4], ['Insurance gap', 2], ['EPC downgrade', 1], ['Listing detected', 1]],
    severities: [['High', 3], ['Critical', 3]],
    floodBias: 0.05,
    hmoBias: 0.04,
    valueRange: [2100000, 16000000],
  },
  {
    name: 'South Lambeth',
    postcode: 'SW8',
    lat: 51.4720, lng: -0.1240, jitterDeg: 0.006,
    types: ['Apartment', 'Flat', 'Mixed Use'],
    signals: [['Listing detected', 3], ['Valuation drop', 3], ['Tenancy change', 2]],
    severities: [['Low', 3], ['Medium', 3], ['High', 1]],
    floodBias: 0.25,
    hmoBias: 0.18,
    valueRange: [400000, 1200000],
  },
  {
    name: 'Brixton',
    postcode: 'SW9',
    lat: 51.4612, lng: -0.1156, jitterDeg: 0.006,
    types: ['Flat', 'Townhouse'],
    signals: [['Tenancy change', 3], ['EPC downgrade', 3], ['Listing detected', 1], ['Subsidence alert', 1]],
    severities: [['Low', 2], ['Medium', 3], ['High', 2]],
    floodBias: 0.05,
    hmoBias: 0.32,
    valueRange: [450000, 1300000],
  },
  {
    name: 'West Brompton',
    postcode: 'SW10',
    lat: 51.4858, lng: -0.1815, jitterDeg: 0.004,
    types: ['Flat', 'Townhouse', 'Apartment'],
    signals: [['Underinsurance', 2], ['Listing detected', 2], ['EPC downgrade', 2], ['Tenancy change', 1]],
    severities: [['Medium', 3], ['High', 2]],
    floodBias: 0.08,
    hmoBias: 0.12,
    valueRange: [780000, 3200000],
  },
  {
    name: 'Battersea',
    postcode: 'SW11',
    lat: 51.4709, lng: -0.1660, jitterDeg: 0.007,
    types: ['Flat', 'Apartment', 'Townhouse'],
    signals: [['Flood risk change', 4], ['Subsidence alert', 2], ['Valuation drop', 1], ['EPC downgrade', 1]],
    severities: [['Medium', 2], ['High', 3], ['Critical', 2]],
    floodBias: 0.7,
    hmoBias: 0.06,
    valueRange: [550000, 2400000],
  },
  {
    name: 'Balham',
    postcode: 'SW12',
    lat: 51.4439, lng: -0.1525, jitterDeg: 0.006,
    types: ['Townhouse', 'Flat'],
    signals: [['EPC downgrade', 3], ['Listing detected', 2], ['Tenancy change', 2], ['Subsidence alert', 1]],
    severities: [['Low', 3], ['Medium', 3], ['High', 1]],
    floodBias: 0.05,
    hmoBias: 0.12,
    valueRange: [620000, 2100000],
  },
  {
    name: 'Barnes',
    postcode: 'SW13',
    lat: 51.4732, lng: -0.2376, jitterDeg: 0.006,
    types: ['Townhouse', 'Detached House'],
    signals: [['Flood risk change', 5], ['Underinsurance', 1], ['Listing detected', 1]],
    severities: [['Medium', 3], ['High', 3]],
    floodBias: 0.78,
    hmoBias: 0.02,
    valueRange: [1400000, 4800000],
  },
  {
    name: 'Mortlake',
    postcode: 'SW14',
    lat: 51.4683, lng: -0.2641, jitterDeg: 0.006,
    types: ['Townhouse', 'Detached House', 'Flat'],
    signals: [['Flood risk change', 3], ['Tenancy change', 2], ['EPC downgrade', 1], ['Listing detected', 1]],
    severities: [['Low', 2], ['Medium', 3]],
    floodBias: 0.45,
    hmoBias: 0.05,
    valueRange: [780000, 2200000],
  },
  {
    name: 'Putney',
    postcode: 'SW15',
    lat: 51.4612, lng: -0.2168, jitterDeg: 0.007,
    types: ['Flat', 'Townhouse', 'Apartment'],
    signals: [['Flood risk change', 3], ['Tenancy change', 2], ['EPC downgrade', 1], ['Listing detected', 1]],
    severities: [['Medium', 3], ['High', 3]],
    floodBias: 0.55,
    hmoBias: 0.1,
    valueRange: [620000, 2400000],
  },
  {
    name: 'Streatham',
    postcode: 'SW16',
    lat: 51.4310, lng: -0.1320, jitterDeg: 0.007,
    types: ['Flat', 'Townhouse'],
    signals: [['EPC downgrade', 3], ['Tenancy change', 3], ['Listing detected', 2]],
    severities: [['Low', 3], ['Medium', 2]],
    floodBias: 0.05,
    hmoBias: 0.28,
    valueRange: [380000, 950000],
  },
  {
    name: 'Tooting',
    postcode: 'SW17',
    lat: 51.4275, lng: -0.1685, jitterDeg: 0.007,
    types: ['Townhouse', 'Flat'],
    signals: [['Tenancy change', 4], ['EPC downgrade', 2], ['Listing detected', 1]],
    severities: [['Low', 3], ['Medium', 3], ['High', 1]],
    floodBias: 0.05,
    hmoBias: 0.45,
    valueRange: [480000, 1300000],
  },
  {
    name: 'Wandsworth',
    postcode: 'SW18',
    lat: 51.4567, lng: -0.1910, jitterDeg: 0.007,
    types: ['Flat', 'Townhouse', 'Apartment'],
    signals: [['Flood risk change', 2], ['Valuation drop', 2], ['EPC downgrade', 2], ['Tenancy change', 1]],
    severities: [['Medium', 3], ['High', 2]],
    floodBias: 0.35,
    hmoBias: 0.1,
    valueRange: [580000, 2000000],
  },
  {
    name: 'Wimbledon',
    postcode: 'SW19',
    lat: 51.4214, lng: -0.2064, jitterDeg: 0.008,
    types: ['Detached House', 'Townhouse', 'Flat'],
    signals: [['Underinsurance', 2], ['Listing detected', 2], ['EPC downgrade', 1], ['Subsidence alert', 1]],
    severities: [['Low', 2], ['Medium', 3], ['High', 2]],
    floodBias: 0.04,
    hmoBias: 0.05,
    valueRange: [780000, 4200000],
  },
];

/* ---------- generic distributions ---------- */

const WORKFLOW_WEIGHTS = [
  ['New', 25],
  ['In review', 30],
  ['Action required', 18],
  ['Awaiting customer', 10],
  ['Resolved', 12],
  ['Snoozed', 5],
];

const TENURE_WEIGHTS = [
  ['Leasehold', 55],
  ['Freehold', 38],
  ['Share of Freehold', 7],
];

const EPC_WEIGHTS = [
  ['A', 4], ['B', 12], ['C', 28], ['D', 30], ['E', 16], ['F', 8], ['G', 2],
];

function ownerFor(severity) {
  if (severity === 'Critical') {
    return pickWeighted([
      ['Sarah Lee', 4],
      ['Risk Team', 5],
      ['James Whitcombe', 3],
      ['Tom Harris', 1],
      ['Priya Patel', 1],
    ]);
  }
  return pickWeighted([
    ['Sarah Lee', 4],
    ['Tom Harris', 4],
    ['Priya Patel', 4],
    ['James Whitcombe', 2],
    ['Risk Team', 1],
    ['Unassigned', 1],
  ]);
}

function floodRiskFromBias(bias) {
  if (rnd() < bias * 0.55) return 'High';
  if (rnd() < bias * 0.7) return 'Medium';
  return 'Low';
}

function noteFor(signalType, neighbourhood) {
  const map = {
    'Flood risk change': `Updated EA flood map upgrades risk band for ${neighbourhood}. Cover review recommended.`,
    'Underinsurance': `Estimated reinstatement cost has overtaken the policy sum insured. Contact policyholder.`,
    'Valuation drop': `Indexed value down vs. last appraisal. Re-confirm LTV exposure.`,
    'EPC downgrade': `Latest EPC certificate fell from previous rating. Review compliance and advisory items.`,
    'Listing detected': `Property listed on a public portal. Confirm intent to sell with policyholder.`,
    'Subsidence alert': `Subsidence reported within 200m. Check claim history and structural movement.`,
    'Tenancy change': `Tenancy churn signal detected — landlord/occupier change likely.`,
    'Insurance gap': `No matching active policy on file for this address. Possible coverage gap.`,
  };
  return map[signalType] || 'New signal received from intelligence pipeline.';
}

/* ---------- generate ---------- */

const PER_NEIGHBOURHOOD = 5;
window.PROPERTIES = [];

let counter = 1;
NEIGHBOURHOODS.forEach((n) => {
  for (let i = 0; i < PER_NEIGHBOURHOOD; i++) {
    const id = 'p-' + String(counter++).padStart(3, '0');
    const severity = pickWeighted(n.severities);
    const signalType = pickWeighted(n.signals);
    const propertyType = pick(n.types);

    const lat = jitter(n.lat, n.jitterDeg);
    const lng = jitter(n.lng, n.jitterDeg);

    const [vMin, vMax] = n.valueRange;
    const value = Math.round((vMin + rnd() * (vMax - vMin)) / 1000) * 1000;

    const isHmo = rnd() < n.hmoBias;
    const flood = floodRiskFromBias(n.floodBias);
    const tenure = pickWeighted(TENURE_WEIGHTS);
    const epc = pickWeighted(EPC_WEIGHTS);
    const workflowStatus = pickWeighted(WORKFLOW_WEIGHTS);
    const assignedTo = ownerFor(severity);

    const bedrooms = randInt(
      propertyType === 'Mansion' ? 5 : 1,
      propertyType === 'Mansion' ? 9 : propertyType === 'Townhouse' ? 5 : 4
    );
    const bathrooms = Math.max(1, Math.min(bedrooms, randInt(1, bedrooms)));
    const sqft = Math.round(
      ((propertyType === 'Mansion' ? 4500 : propertyType === 'Townhouse' ? 1800 :
        propertyType === 'Detached House' ? 1700 : propertyType === 'Apartment' ? 800 : 700) *
        (0.7 + rnd() * 0.6)) / 10
    ) * 10;
    const yearBuilt = randInt(1820, 2022);
    const dateAddedDays = randInt(0, 180);
    const lastValDays = dateAddedDays + randInt(5, 60);

    window.PROPERTIES.push({
      id,
      address: makeAddress(),
      city: n.name,
      postcode: `${n.postcode} ${postcodeUnit()}`,
      lat,
      lng,
      severity,
      dateAdded: daysAgo(dateAddedDays),
      signalType,
      workflowStatus,
      assignedTo,
      type: propertyType,
      bedrooms,
      bathrooms,
      sqft,
      yearBuilt,
      estimatedValue: value,
      lastValuation: daysAgo(lastValDays),
      tenure,
      epc,
      isUnlicensedHmo: isHmo,
      floodRisk: flood,
      notes: noteFor(signalType, n.name),
      alertTags: [],
    });
  }
});

/* ---------- assign alert tags to exactly 20 properties ----------
 *
 * We pick a deterministic random subset of 20 (out of 100) and give
 * each 1-2 alert tags from its neighbourhood's plausible-tag pool.
 */

function shuffleIndices(length, rngFn) {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rngFn() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

const TAGGED_COUNT = 10;
const taggedIndices = new Set(
  shuffleIndices(window.PROPERTIES.length, rng).slice(0, TAGGED_COUNT)
);

window.PROPERTIES.forEach((p, idx) => {
  if (!taggedIndices.has(idx)) return;
  const pool = TAGS_BY_NEIGHBOURHOOD[p.city] || window.ALERT_TAGS;
  const tagCount = pool.length === 1 ? 1 : (rnd() < 0.35 ? 2 : 1);

  // Pick `tagCount` distinct tags from the pool.
  const chosen = new Set();
  let safety = 0;
  while (chosen.size < tagCount && safety < 20) {
    chosen.add(pool[Math.floor(rnd() * pool.length)]);
    safety++;
  }
  p.alertTags = Array.from(chosen);
});
