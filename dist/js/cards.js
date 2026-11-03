/** Original, dependency-free SVG artwork for the forty-card Cuarenta deck. */
const COLORS = Object.freeze({
  paper: '#f5e9ce',
  border: '#bba47b',
  ink: '#233d35',
  red: '#8b3239',
  gold: '#b09255',
  back: '#632c32',
});

const SUITS = Object.freeze({
  hearts: {
    name: 'corazones',
    color: COLORS.red,
    shape: '<path d="M0 8C-2.7 5.2-9-.1-9-4.2C-9-8.8-3.1-10.4 0-6.1C3.1-10.4 9-8.8 9-4.2C9-.1 2.7 5.2 0 8Z"/>',
  },
  diamonds: {
    name: 'diamantes',
    color: COLORS.red,
    shape: '<path d="M0-10 7 0 0 10-7 0Z"/>',
  },
  clubs: {
    name: 'tréboles',
    color: COLORS.ink,
    shape: '<circle cy="-4.5" r="4.5"/><circle cx="-4.4" cy="1.1" r="4.5"/><circle cx="4.4" cy="1.1" r="4.5"/><path d="M-1.7 2.5C-1.3 5.3-1.6 7.5-4.1 9H4.1C1.6 7.5 1.3 5.3 1.7 2.5Z"/>',
  },
  spades: {
    name: 'picas',
    color: COLORS.ink,
    shape: '<path d="M0-10C-2.1-6.2-8.8-2.1-8.8 2.4C-8.8 7.1-3.2 8.1 0 4.8C3.2 8.1 8.8 7.1 8.8 2.4C8.8-2.1 2.1-6.2 0-10ZM-1.7 3.7C-1.3 6.2-1.8 8-4.2 10H4.2C1.8 8 1.3 6.2 1.7 3.7Z"/>',
  },
});

const RANK_NAMES = Object.freeze({
  A: 'As', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco',
  6: 'Seis', 7: 'Siete', J: 'Sota', Q: 'Reina', K: 'Rey',
});

// Each pip is [horizontal position, vertical position, inverted].
const PIPS = Object.freeze({
  2: [[50, 41, false], [50, 103, true]],
  3: [[50, 40, false], [50, 72, false], [50, 104, true]],
  4: [[34, 41, false], [66, 41, false], [34, 103, true], [66, 103, true]],
  5: [[34, 41, false], [66, 41, false], [50, 72, false], [34, 103, true], [66, 103, true]],
  6: [[34, 40, false], [66, 40, false], [34, 72, false], [66, 72, false], [34, 104, true], [66, 104, true]],
  7: [[34, 40, false], [66, 40, false], [50, 56, false], [34, 72, false], [66, 72, false], [34, 104, true], [66, 104, true]],
});

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function validateCard(card) {
  if (!card || typeof card !== 'object') {
    throw new TypeError('La carta debe tener un rango y un palo válidos de Cuarenta.');
  }
  const { rank, suit } = card;
  if (typeof rank !== 'string' || typeof suit !== 'string' ||
      !Object.hasOwn(RANK_NAMES, rank) || !Object.hasOwn(SUITS, suit)) {
    throw new TypeError('La carta debe tener un rango y un palo válidos de Cuarenta.');
  }
  return { rank, suit: SUITS[suit] };
}

function pip(suit, x, y, size, inverted = false) {
  return `<g fill="${suit.color}" transform="translate(${x} ${y}) rotate(${inverted ? 180 : 0}) scale(${size / 20})">${suit.shape}</g>`;
}

function svgRoot(label, contents) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 144" role="img" aria-label="${escapeXml(label)}" focusable="false"><title>${escapeXml(label)}</title>${contents}</svg>`;
}

function corner(rank, suit) {
  return `<g fill="${suit.color}"><text x="11.5" y="19.5" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-weight="700">${escapeXml(rank)}</text>${pip(suit, 11.5, 28, 8.5)}</g>`;
}

function court(rank, suit) {
  const ornaments = {
    J: '<path d="M40 37q0-9 13-9l8 6-5 5Z"/><path d="M53 29q6-10 14-8-4 7-11 10" fill="none" stroke-width="1.1"/><path d="m39 37 20-3 1 4-20 3Z"/>',
    Q: '<path d="m40 38-1-10 6 5 6-8 6 8 6-5-2 10Z"/><circle cx="39" cy="27" r="1.2"/><circle cx="51" cy="24" r="1.2"/><circle cx="63" cy="27" r="1.2"/>',
    K: '<path d="m40 38-2-11 7 6 6-8 6 8 7-6-3 11Z"/><path d="M51 21v8m-3-5h6" fill="none" stroke-width="1.2"/><path d="m46 32 5 4 5-4" fill="none"/>',
  };
  const hair = rank === 'Q'
    ? '<path d="M43 38c-8 4-8 16-6 23l7-6 1-17Zm14-1c6 6 7 13 3 23l-5-5Z"/>'
    : '<path d="M43 38c-5 6-4 12 0 16l3-5-1-11Z"/>';
  const beard = rank === 'K' ? `<path d="M47 48q5 5 11 1l-3 12-9-7Z" fill="${suit.color}"/><path d="m49 51 1 6m3-5-1 7" stroke="${COLORS.gold}" stroke-width=".5"/>` : '';
  const half = `<g stroke="${suit.color}" stroke-width=".7" stroke-linejoin="round"><path d="M29 69v-8l16-7h11l15 7v8Z" fill="${suit.color}"/><path d="m30 63 14-7 6 12H30Zm26-7 14 7v5H51Z" fill="${COLORS.gold}"/><path d="m32 62 5 7m0-9 5 9m0-11 5 11m11-11 5 11m0-9 5 9" fill="none" stroke-width=".55"/><path d="M43 38h15v8l4 2-5 3-3 6-9-4-2-6Z" fill="${COLORS.paper}"/><g fill="${suit.color}">${hair}</g><path d="m52 42 5 0m-2 1v1m-2 7h3m-8-9-1 5 3 1" fill="none"/><g fill="${COLORS.gold}">${ornaments[rank]}</g>${beard}<path d="m44 55 6 8 6-7-1 11H45Z" fill="${COLORS.paper}"/><path d="M50 58v8" stroke-width=".5"/></g><path d="m27 43 2 3-2 3-2-3Zm46 11 2 3-2 3-2-3Z" fill="${COLORS.gold}"/>`;
  return `<rect x="23" y="23" width="54" height="98" rx="1" fill="#ece0bf" stroke="${COLORS.border}" stroke-width=".7"/><rect x="26" y="26" width="48" height="92" fill="none" stroke="${COLORS.gold}" stroke-width=".4"/>${half}<g transform="rotate(180 50 72)">${half}</g><rect x="27" y="69" width="46" height="6" fill="${suit.color}"/><path d="M28 72h44" stroke="${COLORS.gold}" stroke-width=".6"/>${pip(suit, 18, 72, 8)}${pip(suit, 82, 72, 8, true)}`;
}

/** Human-readable Spanish label; no card identifier is exposed in the SVG. */
export function cardLabel(card) {
  const { rank, suit } = validateCard(card);
  return `${RANK_NAMES[rank]} de ${suit.name}`;
}

/** A complete, accessible SVG with no IDs, external assets, or shared definitions. */
export function cardSvg(card) {
  const { rank, suit } = validateCard(card);
  const corners = corner(rank, suit);
  let center;
  if (rank === 'A') {
    center = `<path d="M37 42q13-10 26 0M37 102q13 10 26 0M35 45q-17 27 0 54m30-54q17 27 0 54" fill="none" stroke="${COLORS.gold}" stroke-width=".7"/><path d="m35 52-4-4 0 7m1 7-5-3 2 7m2 6-5-1 3 5m1 6-4 1 5 5m1 5-3 3 6 1m30-44 4-4 0 7m-1 7 5-3-2 7m-2 6 5-1-3 5m-1 6 4 1-5 5m-1 5 3 3-6 1" fill="none" stroke="${COLORS.gold}" stroke-width=".6"/>${pip(suit, 50, 72, 32)}`;
  } else if (Object.hasOwn(PIPS, rank)) {
    center = PIPS[rank].map(([x, y, inverted]) => pip(suit, x, y, 17, inverted)).join('');
  } else {
    center = court(rank, suit);
  }
  return svgRoot(`${RANK_NAMES[rank]} de ${suit.name}`, `<rect x=".7" y=".7" width="98.6" height="142.6" rx="5.5" fill="${COLORS.paper}" stroke="${COLORS.border}" stroke-width="1.1"/><rect x="3.2" y="3.2" width="93.6" height="137.6" rx="3.5" fill="none" stroke="#fff8e7" stroke-width="1.2"/><path d="M24 6h52M24 138h52M6 40v64m88-64v64" stroke="${COLORS.border}" stroke-width=".4" opacity=".65"/><g fill="${COLORS.gold}" opacity=".15"><circle cx="6" cy="36" r=".8"/><circle cx="94" cy="108" r=".8"/><circle cx="82" cy="8" r=".6"/><circle cx="18" cy="136" r=".6"/><circle cx="8" cy="119" r=".5"/><circle cx="92" cy="25" r=".5"/></g>${corners}<g transform="rotate(180 50 72)">${corners}</g>${center}`);
}

/** Symmetric ornamental back, deliberately independent of the hidden card. */
export function cardBackSvg() {
  let lattice = '';
  for (let y = 18; y <= 126; y += 12) {
    for (let x = 20; x <= 80; x += 12) {
      lattice += `<path d="m${x} ${y - 4} 3 4-3 4-3-4Z"/><path d="M${x - 3} ${y}h6m-3-3v6"/><circle cx="${x + 6}" cy="${y + 6}" r=".65"/>`;
    }
  }
  const flourish = '<path d="M15 32V15h17m-17 7q12 0 12-7m-12 14q17 0 17-14m-11 1 3 3-3 3-3-3Z"/>';
  return svgRoot('Reverso de carta', `<rect x=".7" y=".7" width="98.6" height="142.6" rx="5.5" fill="${COLORS.paper}" stroke="${COLORS.border}" stroke-width="1.1"/><rect x="5" y="5" width="90" height="134" rx="2.5" fill="${COLORS.back}" stroke="${COLORS.gold}" stroke-width=".65"/><rect x="9" y="9" width="82" height="126" rx="1" fill="none" stroke="${COLORS.gold}" stroke-width=".4"/><g fill="none" stroke="${COLORS.gold}" stroke-width=".4" opacity=".65">${lattice}</g><g fill="none" stroke="#d6bd87" stroke-width=".7">${flourish}<g transform="translate(100 144) rotate(180)">${flourish}</g><g transform="translate(100 0) scale(-1 1)">${flourish}</g><g transform="translate(0 144) scale(1 -1)">${flourish}</g></g><ellipse cx="50" cy="72" rx="27" ry="35" fill="${COLORS.back}" stroke="${COLORS.gold}" stroke-width="1.3"/><ellipse cx="50" cy="72" rx="23.5" ry="31.5" fill="none" stroke="${COLORS.gold}" stroke-width=".5"/><path d="m50 46 3 4-3 4-3-4Zm0 44 3 4-3 4-3-4Z" fill="${COLORS.gold}"/><path d="M33 58q17-5 34 0M33 86q17 5 34 0" fill="none" stroke="${COLORS.gold}" stroke-width=".4"/><text x="50" y="82" text-anchor="middle" fill="#ead6a8" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" letter-spacing="-2">40</text>`);
}
