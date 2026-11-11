import { createDeck, DEFAULT_BOT_NAME, legalMoves } from './engine.js';
import { chooseBotMove } from './bot.js';
import { cardSvg, cardBackSvg, cardLabel } from './cards.js';
import { LocalSession, FELT_THEMES, loadPreferences, normalizeFeltColor, savePreferences } from './session.js';
import { createTutorialLessons } from './tutorial.js';
import { MUSIC_TRACKS, TableMusic } from './music.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const session = new LocalSession();
const prefs = loadPreferences();
let screen = 'home';
let mode = 'solo';
let comboPoints = 2;
let difficulty = 'medium';
const draftNames = { player: '', solo: '', pass: '' };
const difficultyNames = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil', expert: 'Experto' };
const tableLayouts = { horizontal: 'Horizontal', vertical: 'Vertical' };
const feltNames = { quito: 'Verde Quito', borgona: 'Borgoña', azul: 'Azul noche', carbon: 'Carbón', custom: 'Mi propio color' };
const landscapeGame = window.matchMedia('(orientation: landscape) and (max-width: 1199px) and (max-height: 850px), (orientation: landscape) and (max-width: 1400px) and (pointer: coarse)');
const mobileView = window.matchMedia('(pointer: coarse), (max-width: 600px)');
const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const impactCards = new Map(createDeck().map(card => [card.id, card]));
let horizontalRequested = false;
let pendingNativeRotation = false;
let rotationOwnsFullscreen = false;
let rotationOwnsLock = false;
const difficultyNotes = {
  easy: 'Una mesa tranquila: la máquina varía sus jugadas y aprovecha las victorias inmediatas.',
  medium: 'La máquina busca puntos y buenas capturas.',
  hard: 'La máquina calcula respuestas y cuida sus cartas de ronda.',
  expert: prefs.feedbackMode ? 'Analiza respuestas probables; al terminar la partida podrás valorar el reto.' : 'Analiza respuestas probables; la retroalimentación está desactivada en Preferencias.',
};
const legacyRules = v => v?.rules.id.startsWith('cuarenta-local-v1-');
let viewer = 0;
let locked = false;
let selectedId = null;
let selectedMoveIndex = 0;
let botTimer = null;
let toastTimer = null;
let renderedDeal = '';
let renderedTurn = '';
let pendingCardArrival = false;
let pendingPassMove = null;
let tutorialStep = 0;
let tutorialLessons = [];
let tutorialComboPoints = null;
let tutorialCardId = null;
const tutorialCaptures = new Set();
const tutorialSolved = new Map();
let tutorialFeedback = '';
let tutorialComplete = false;
let modalKind = null;
let lastFocus = null;
let audioContext = null;
const tableMusic = new TableMusic({ getContext: getAudioContext });
let musicActivated = false;
let musicAttempt = null;
const FEEDBACK_MATCH_KEY = 'cuarenta.local.feedback.match.v1';
let feedbackCompletedMatchId = (() => {
  try { return globalThis.localStorage?.getItem(FEEDBACK_MATCH_KEY) || ''; }
  catch { return ''; }
})();

const iconPaths = {
  play: '<path d="m9 5 11 7-11 7z"/>',
  cards: '<rect x="7" y="3" width="13" height="17" rx="2"/><path d="m4 6-2 1 4 15 11-3M11 8h5M11 12h3"/>',
  book: '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  sound: '<path d="m11 4-6 5H2v6h3l6 5zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5zM16 9l6 6m0-6-6 6"/>',
  music: '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="18" cy="16" rx="3" ry="2.5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m2 3c3 1 3 3 3 6"/>',
  bot: '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 12v4m22-4v4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3c0 3 2 5 5 5m9-8h4v3c0 3-2 5-5 5M12 15v6m-5 0h10"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.2 1.2 0 0 1 .9-2H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r=".8"/><circle cx="11" cy="7.3" r=".8"/><circle cx="16" cy="9" r=".8"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.cards}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const demoCard = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit });
const getView = () => session.view(viewer);

function cardMarkup(card, { back = false, selected = false, highlight = false, interactive = false, last = false, action = 'select-card' } = {}) {
  const tag = interactive ? 'button' : 'div';
  return `<${tag} class="playing-card ${back ? 'card-back' : ''} ${selected ? 'selected' : ''} ${highlight ? 'highlight' : ''} ${last ? 'last-card' : ''}" ${interactive ? `type="button" data-action="${action}" data-card="${esc(card.id)}" aria-label="${esc(cardLabel(card))}${last ? ' · Última carta rival' : ''}" aria-pressed="${selected}"` : `aria-label="${back ? 'Carta oculta' : esc(cardLabel(card))}" role="img"`}>${back ? cardBackSvg() : cardSvg(card)}</${tag}>`;
}

function shell(content) {
  return `<div class="app-shell${screen === 'game' ? ' is-playing' : ''}">
    <aside class="sidebar" aria-label="Menú principal">
      <button class="brand" data-action="home" aria-label="Cuarenta, inicio"><span class="brand-mark">40<span>◆</span></span><span class="brand-word">cuarenta<span>DE AQUÍ, DE SIEMPRE</span></span></button>
      <nav><button class="nav-item active" data-action="home">${icon('cards')}<span>La mesa</span></button><button class="nav-item" data-action="tutorial">${icon('book')}<span>Aprender a jugar</span></button><button class="nav-item" data-action="settings">${icon('settings')}<span>Preferencias</span></button></nav>
      <div class="sidebar-bottom"><span class="ecuador-stripes" aria-hidden="true"><i></i><i></i><i></i></span><span>Una tradición ecuatoriana.<br>Una mesa para todos.</span></div>
    </aside>
    <div class="main-shell"><header class="topbar"><div class="breadcrumb">${screen === 'home' ? 'Bienvenido a tu mesa' : `<button data-action="home">La mesa</button><span>/</span><strong>Partida local</strong>`}</div><div class="topbar-actions"><span class="local-badge"><i></i> En este dispositivo</span><button type="button" class="icon-button music-toggle" data-action="music" aria-label="Música de fondo" aria-pressed="${prefs.music}" title="${prefs.music ? 'Pausar' : 'Activar'} música de fondo">${icon('music')}</button><button class="icon-button sound-toggle" data-action="sound" aria-label="${prefs.sound ? 'Desactivar' : 'Activar'} sonido" title="${prefs.sound ? 'Desactivar' : 'Activar'} sonido">${icon(prefs.sound ? 'sound' : 'mute')}</button><button class="icon-button mobile-settings" data-action="settings" aria-label="Preferencias">${icon('settings')}</button></div></header><main id="main" tabindex="-1">${content}</main><footer class="footer"><span>Hecho para disfrutar, carta a carta.</span><button data-action="rules">Reglas de esta mesa ${icon('arrow')}</button></footer></div>
  </div>`;
}

function renderHome() {
  const saved = session.view(0);
  const canResume = saved && saved.status !== 'finished';
  const opponentLabel = mode === 'solo' ? 'Nombre del bot (opcional)' : 'Nombre del otro jugador';
  const opponentDefault = mode === 'solo' ? DEFAULT_BOT_NAME : 'Jugador 2';
  app.innerHTML = shell(`<section class="welcome-heading"><div><p class="eyebrow">EL JUEGO QUE NOS REÚNE</p><h1>El Cuarenta de siempre.</h1><p class="intro">Baraja, reparte y disfruta. La próxima buena mano empieza aquí.</p></div></section>
    <section class="lobby-layout" aria-label="Preparar una partida">
      <div class="hero-table"><div class="hero-table-inner"><div class="hero-fan" aria-hidden="true">${cardMarkup(demoCard('A', 'hearts'))}${cardMarkup(demoCard('7', 'clubs'))}${cardMarkup(demoCard('K', 'diamonds'))}</div></div><div class="hero-bottom"><span>Tu mesa de Cuarenta</span><button type="button" class="felt-shortcut" data-action="felt-settings">${icon('palette')} Cambiar color de mesa</button></div></div>
      <div class="setup-panel"><h2>¿Cómo jugamos?</h2><div class="mode-options" role="group" aria-label="Modo de juego"><button class="mode-option ${mode === 'solo' ? 'chosen' : ''}" data-action="mode" data-mode="solo" aria-pressed="${mode === 'solo'}"><span class="mode-icon">${icon('bot')}</span><span><strong>Contra la máquina</strong><small>Juega contra ${DEFAULT_BOT_NAME}.</small></span><span class="radio-dot"></span></button><button class="mode-option ${mode === 'pass' ? 'chosen' : ''}" data-action="mode" data-mode="pass" aria-pressed="${mode === 'pass'}"><span class="mode-icon">${icon('people')}</span><span><strong>Pasar el dispositivo</strong><small>Dos personas, una misma mesa.</small></span><span class="radio-dot"></span></button></div>
      <form id="new-game-form">${mode === 'solo' ? `<div class="difficulty-picker"><label for="bot-difficulty">Nivel de la máquina</label><select id="bot-difficulty" name="difficulty" aria-describedby="difficulty-note">${Object.entries(difficultyNames).map(([key,label]) => `<option value="${key}" ${difficulty === key ? 'selected' : ''}>${label}</option>`).join('')}</select><p class="difficulty-note" id="difficulty-note">${difficultyNotes[difficulty]}</p></div>` : ''}<div class="name-fields"><label>Tu nombre<input id="player-name" name="player" autocomplete="off" maxlength="20" placeholder="Tú" value="${esc(draftNames.player)}"></label><label>${opponentLabel}<input id="opponent-name" name="opponent" autocomplete="off" maxlength="20" placeholder="${opponentDefault}" value="${esc(draftNames[mode])}"></label></div><div class="combo-choice"><span>Caída y limpia juntas ${icon('spark')}</span><div role="group" aria-label="Puntos de caída y limpia"><button type="button" class="${comboPoints === 2 ? 'chosen' : ''}" data-action="combo" data-points="2" aria-pressed="${comboPoints === 2}">2 puntos</button><button type="button" class="${comboPoints === 4 ? 'chosen' : ''}" data-action="combo" data-points="4" aria-pressed="${comboPoints === 4}">4 puntos</button></div></div>${tableLayoutPicker()}<button class="button primary start-button" type="submit">Repartir cartas ${icon('arrow')}</button></form>
      ${canResume ? `<button class="button resume-button" data-action="resume">${icon('play')} Continuar partida · ${saved.players[0].score} a ${saved.players[1].score}</button>` : ''}
      ${canResume && legacyRules(saved) ? '<p class="legacy-note">Tu partida guardada conserva las reglas anteriores. Reparte una nueva para activar la caída a la ronda.</p>' : ''}<p class="setup-footnote">A 40 puntos · Sin reloj · <button data-action="rules">Ver reglas</button></p></div>
    </section>`);
}

function playerBadge(player, mine, active) {
  return `<div class="player-badge ${active ? 'is-turn' : ''}"><span class="avatar ${mine ? 'avatar-self' : ''}">${icon(!mine && mode === 'solo' ? 'bot' : 'person')}</span><span><strong>${esc(player.name)}</strong><small>${active ? 'Tiene la mano' : `${player.handCount} cartas en mano`}</small></span>${active ? '<span class="turn-dot"></span>' : ''}</div>`;
}

function scorePanel(v) {
  return `<section class="score-panel"><div class="panel-label">EL MARCADOR <span>40 para ganar</span></div>${v.players.map((p, i) => `<div class="score-row"><div class="score-name"><span class="score-dot ${i ? 'opponent-dot' : ''}"></span>${esc(p.name)}</div><strong>${p.score}<span> / 40</span></strong><div class="score-track"><span class="${i ? 'opponent-fill' : ''}" style="width:${Math.min(100, p.score / 40 * 100)}%"></span></div><small>${p.capturedCount} cartas recogidas${p.score === 38 ? (legacyRules(v) ? ' · Solo te falta una caída' : ' · Cierras con caída o ronda') : ''}</small></div>`).join('')}<div class="score-rule">${icon('spark')} Caída y limpia: ${v.rules.comboPoints} puntos</div></section>`;
}

function tableLayoutPicker() {
  const buttons = Object.entries(tableLayouts).map(([value, label]) =>
    `<button type="button" data-action="table-layout" data-layout="${value}" aria-pressed="${prefs.tableLayout === value}">${label}</button>`
  );
  return `<div class="table-layout-choice">
    <span class="table-layout-label" id="table-layout-label">Vista de la mesa</span>
    <div class="table-layout-picker" role="group" aria-labelledby="table-layout-label">${buttons.join('')}</div>
  </div>`;
}

function changeTableLayout(layout) {
  if (!Object.hasOwn(tableLayouts, layout)) return;
  horizontalRequested = layout === 'horizontal';
  if (!horizontalRequested) releaseNativeRotation();
  const changed = prefs.tableLayout !== layout;
  prefs.tableLayout = layout;
  updateGameOrientation();
  for (const button of app.querySelectorAll('.table-layout-picker button')) {
    button.setAttribute('aria-pressed', String(button.dataset.layout === layout));
  }
  if (changed && !savePreferences(prefs)) toast('No se pudo guardar la orientación en este navegador.');
  if (horizontalRequested) void requestNativeRotation();
}

function updateGameOrientation() {
  const physicalLandscape = window.innerWidth > window.innerHeight;
  const rotated = horizontalRequested && mobileView.matches && !physicalLandscape;
  const root = document.documentElement;
  if (root.classList.contains('is-rotated-view') !== rotated) app.scrollTop = 0;
  root.classList.toggle('is-rotated-view', rotated);
  const gameShell = app.querySelector('.app-shell');
  if (!gameShell) return;
  const landscape = landscapeGame.matches || rotated;
  const compact = landscape && (rotated ? window.innerWidth : window.innerHeight) <= 500;
  gameShell.classList.toggle('is-compact-play', compact);
  if (screen !== 'game') return;
  gameShell.classList.toggle('is-landscape-play', landscape);
  gameShell.querySelector('#main').dataset.tableLayout = prefs.tableLayout;
}

async function requestNativeRotation() {
  const orientation = window.screen?.orientation;
  if (!mobileView.matches || !orientation?.lock || pendingNativeRotation || rotationOwnsLock) return;
  pendingNativeRotation = true;
  try {
    if (!document.fullscreenElement && document.fullscreenEnabled && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      rotationOwnsFullscreen = document.fullscreenElement === document.documentElement;
    }
    if (!horizontalRequested) return;
    await orientation.lock('landscape');
    rotationOwnsLock = true;
  } catch {
    // The rotated page remains available when the browser declines a native lock.
  } finally {
    pendingNativeRotation = false;
    if (!horizontalRequested) releaseNativeRotation();
    updateGameOrientation();
  }
}

function releaseNativeRotation() {
  if (rotationOwnsLock) {
    try { window.screen?.orientation?.unlock?.(); } catch { /* Restore the page even if the browser refuses. */ }
  }
  rotationOwnsLock = false;
  if (rotationOwnsFullscreen && document.fullscreenElement === document.documentElement) {
    document.exitFullscreen().catch(() => {});
  }
  rotationOwnsFullscreen = false;
}

function renderGame() {
  const v = getView();
  if (!v) { screen = 'home'; renderHome(); return; }
  mode = v.mode;
  const me = v.players[viewer];
  const other = v.players[1 - viewer];
  const myTurn = v.turn === viewer && v.status === 'playing' && !locked;
  const moves = myTurn ? legalMoves(v, viewer).filter(m => m.cardId === selectedId) : [];
  selectedMoveIndex = Math.min(selectedMoveIndex, Math.max(0, moves.length - 1));
  const chosen = moves[selectedMoveIndex];
  const captureIds = chosen?.captureIds || [];
  const visibleHistory = locked ? v.history.filter(event => event.kind !== 'ronda') : v.history;
  let instruction = v.status === 'round-end' ? 'Terminó el ciclo. Vamos a contar el cartón.' : v.status === 'finished' ? 'La chica ya tiene ganador.' : locked ? 'Las cartas están ocultas. Pasa el dispositivo.' : !myTurn ? `${other.name} está pensando…` : selectedId ? (captureIds.length ? `Recoges ${captureIds.length + 1} cartas${chosen.points ? ` · +${chosen.points} puntos` : ''}` : 'Esta carta se quedará en la mesa.') : 'Tu turno. Elige una carta de tu mano.';
  if (chosen?.rondaFall) instruction = '¡Caída a la ronda! Esta jugada gana la partida.';
  else if (chosen?.winsGame) instruction = 'Esta jugada completa los 40 puntos.';
  app.innerHTML = shell(`<div class="game-heading"><div><p class="eyebrow">${mode === 'solo' ? `TÚ CONTRA ${esc(other.name)}` : 'UNA MESA PARA DOS'}</p><h1>Que hablen las cartas.</h1>${mode === 'solo' ? `<span class="difficulty-badge">Mesa ${difficultyNames[v.difficulty || 'medium'].toLowerCase()}</span>` : ''}</div><div class="game-heading-actions">${tableLayoutPicker()}<button class="button outline small-button" data-action="new">${icon('cards')} Nueva partida</button></div></div><div class="game-layout"><section class="game-column"><div class="game-table ${locked ? 'table-locked' : ''}" aria-label="Mesa de Cuarenta"><div class="table-meta"><span>CICLO ${v.round} <i>·</i> REPARTO ${v.deal}/4</span><span class="deck-label">${icon('cards')} ${v.deckCount} por repartir</span></div><div class="opponent-zone">${playerBadge(other, false, v.turn === other.id)}<div class="opponent-hand" aria-label="${other.handCount} cartas ocultas">${Array.from({ length: other.handCount }, () => cardMarkup(null, { back: true })).join('')}</div></div><div class="table-center"><span class="felt-watermark" aria-hidden="true">40</span><div class="table-cards" aria-label="Cartas sobre la mesa">${v.table.length ? v.table.map(c => cardMarkup(c, { highlight: captureIds.includes(c.id), last: v.lastPlay?.cardId === c.id })).join('') : '<div class="empty-table"><span>La mesa está limpia.</span><small>Una carta puede cambiarlo todo.</small></div>'}</div></div><div class="own-zone">${!locked && v.rondas?.[viewer] && me.hand?.some(c => v.rondas[viewer].cardIds.includes(c.id)) ? `<div class="ronda-notice">${icon('spark')} Tu ronda de ${esc(v.rondas[viewer].rank)} · +2 al repartir</div>` : ''}<div class="own-label">${playerBadge(me, true, v.turn === me.id)}<span class="hand-tip">${myTurn ? 'ELIGE TU CARTA' : 'TU MANO'}</span></div><div class="own-hand ${myTurn ? '' : 'waiting-hand'}" aria-label="${locked ? 'Mano oculta' : 'Tu mano'}">${locked ? Array.from({ length: me.handCount }, () => cardMarkup(null, { back: true })).join('') : (me.hand || []).map(c => cardMarkup(c, { interactive: myTurn, selected: c.id === selectedId })).join('')}</div></div>${locked ? `<div class="privacy-curtain"><div class="privacy-icon">${icon('eye')}</div><p class="eyebrow">CAMBIO DE TURNO</p><h2>Pasa el dispositivo a<br>${esc(v.players[v.turn].name)}.</h2><p>Tu mano solo aparece cuando estés listo.</p><button class="button gold" data-action="reveal">Soy ${esc(v.players[v.turn].name)} · Ver mi mano ${icon('arrow')}</button></div>` : ''}</div><div class="action-panel"><div class="action-copy"><span class="action-dot ${myTurn ? 'ready' : ''}"></span><div><strong>${esc(instruction)}</strong><small>${chosen ? moveDescription(chosen) : myTurn ? 'Haz clic o toca una carta. Después confirma la jugada.' : 'Sin prisa. Aquí se juega a gusto.'}</small></div></div><div class="move-controls">${moves.length > 1 ? `<button class="button outline option-button" data-action="next-capture">Opción ${selectedMoveIndex + 1} de ${moves.length}</button>` : ''}${v.status === 'round-end' ? '<button class="button primary" data-action="round-summary">Ver el conteo</button>' : v.status === 'finished' ? '<button class="button primary" data-action="result">Ver resultado</button>' : `<button class="button primary play-button" data-action="play" ${!chosen || locked ? 'disabled' : ''}>${chosen?.captureIds.length ? 'Recoger cartas' : 'Jugar carta'} ${icon('arrow')}</button>`}</div></div><div class="save-status">${icon(session.warning ? 'shield' : 'check')} ${esc(session.warning || 'Partida guardada en este navegador')}${mode === 'pass' ? '<span>Las manos se ocultan entre turnos.</span>' : ''}</div></section><aside class="game-aside" aria-label="Marcador e historial">${scorePanel(v)}<section class="history-panel"><div class="panel-label">ASÍ VA LA PARTIDA <span>Últimas jugadas</span></div><ol class="history-list">${visibleHistory.slice(-7).reverse().map((e, i) => `<li class="${i === 0 ? 'latest' : ''}"><span class="history-icon">${icon(e.points ? 'spark' : 'cards')}</span><span>${esc(e.text)}</span></li>`).join('') || '<li>La baraja está lista. ¡A jugar!</li>'}</ol></section><button class="help-tile" data-action="rules">${icon('book')}<span>¿Una duda con las reglas?<small>El reglamento de esta mesa</small></span>${icon('arrow')}</button></aside></div>`);
  updateGameOrientation();
  const table = app.querySelector('.game-table');
  const dealKey = `${v.id}/${v.round}/${v.deal}`;
  // In pass-and-play, deal the visible hand only after the player unlocks it.
  if (!locked && v.status === 'playing' && renderedDeal !== dealKey) {
    renderedDeal = dealKey;
    table.classList.add('is-dealing');
  }
  table.classList.toggle('is-own-turn', myTurn);
  const turnKey = `${v.id}/${v.revision}/${viewer}`;
  if (myTurn && renderedTurn !== turnKey) {
    renderedTurn = turnKey;
    table.classList.add('is-fresh-turn');
  }
  table.classList.toggle('is-fresh-play', pendingCardArrival);
  pendingCardArrival = false;
  app.querySelector('.table-meta').insertAdjacentHTML('afterend', `<div class="compact-score" aria-label="Puntuación actual">${v.players.map(p => `<span><span>${esc(p.name)}</span><strong>${p.score}<small> / 40</small></strong></span>`).join('')}</div>`);
}

function moveDescription(move) {
  if (move.rondaFall) return 'Capturas la carta de la ronda del turno anterior: victoria inmediata.';
  if (move.fall && move.clean) return 'Caída y limpia. ¡Una buena jugada!';
  if (move.fall) return 'Caída: recoges la carta que acaba de jugar tu rival.';
  if (move.clean) return 'Limpia: no quedará ninguna carta en la mesa.';
  if (move.kind === 'sum') return 'Captura por suma; se incluye la escalera disponible.';
  if (move.kind === 'match') return 'Captura por igualdad; se incluye la escalera disponible.';
  return 'No hay captura disponible con esta carta.';
}

function render() {
  document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion);
  applyFelt();
  if (screen === 'home') {
    renderHome();
    updateGameOrientation();
  } else {
    renderGame();
  }
}

function focusGame() {
  app.querySelector('#main').focus({ preventScroll: true });
  app.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function announce(text) { document.querySelector('#announcement').textContent = text; }
function toast(text) {
  const node = document.querySelector('#toast');
  clearTimeout(toastTimer); node.textContent = text; node.hidden = false;
  toastTimer = setTimeout(() => { node.hidden = true; }, 4500);
}

function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    audioContext = new Context();
  }
  return audioContext;
}

function playSound(points = 0) {
  if (!prefs.sound) return;
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state !== 'running') void context.resume().catch(() => {});
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine'; osc.frequency.value = points ? 660 : 350;
    gain.gain.setValueAtTime(.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .13);
    osc.connect(gain); gain.connect(context.destination); osc.start(); osc.stop(context.currentTime + .14);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch { /* Sound never interrupts the game. */ }
}

function startMusic(reportError = false) {
  const trackId = prefs.musicTrack;
  if (!prefs.music || document.hidden || musicAttempt?.trackId === trackId) return;
  musicActivated = true;
  const attempt = { trackId };
  musicAttempt = attempt;
  const status = modal.querySelector('#music-status');
  if (status) { status.hidden = true; status.textContent = ''; }
  void tableMusic.start({ trackId, volume: prefs.musicVolume }).then(played => {
    if (musicAttempt !== attempt) return;
    musicAttempt = null;
    if (played || !reportError) return;
    toggleMusic(false);
    const message = 'No se pudo iniciar la música. Toca la nota musical para volver a activarla.';
    const currentStatus = modal.open && modal.querySelector('#music-status');
    if (currentStatus) { currentStatus.textContent = message; currentStatus.hidden = false; }
    else toast(message);
  });
}

function pauseMusic() {
  musicAttempt = null;
  tableMusic.pause();
}

function toggleMusic(enabled) {
  prefs.music = enabled;
  if (!savePreferences(prefs)) toast('No se pudo guardar la preferencia de música.');
  const button = app.querySelector('[data-action="music"]');
  button.setAttribute('aria-pressed', String(enabled));
  button.title = `${enabled ? 'Pausar' : 'Activar'} música de fondo`;
  const checkbox = modal.querySelector('#music-enabled');
  if (checkbox) checkbox.checked = enabled;
  if (enabled) startMusic(true);
  else pauseMusic();
}

function cancelBot() { clearTimeout(botTimer); botTimer = null; }
function scheduleBot(delay = 0) {
  cancelBot();
  const v = session.view(0);
  if (screen !== 'game' || document.hidden || modal.open || !v || v.mode !== 'solo' || v.turn !== 1 || v.status !== 'playing') return;
  const revision = v.revision;
  botTimer = setTimeout(() => {
    if (session.revision !== revision || screen !== 'game' || document.hidden || modal.open) return;
    try {
      const botView = session.view(1);
      const command = chooseBotMove(botView, {
        feedbackChallenge: prefs.feedbackMode ? prefs.feedbackChallenge : 0,
      });
      const move = command && legalMoves(botView, 1).find(candidate =>
        candidate.cardId === command.cardId && candidate.captureIds.length === command.captureIds.length &&
        candidate.captureIds.every(id => command.captureIds.includes(id)));
      if (!move) throw new Error('No se pudo resolver el turno de la máquina.');
      session.dispatch({ type: 'PLAY', move: command }); afterMove(move, 1);
    } catch (error) { toast(error.message); render(); }
  }, Math.max(delay, prefs.quickBot || prefs.reducedMotion ? 280 : 1000));
}

function showPlayImpact(view, move) {
  const win = view.status === 'finished';
  const roundWin = win && ['ronda-victory', 'ronda-fall'].includes(view.lastEvent?.kind);
  if (!win && !move?.fall) return 0;
  const kind = roundWin ? 'ronda' : win ? 'win' : 'fall';
  const caption = roundWin
    ? (view.lastEvent.kind === 'ronda-fall' ? '¡Caída a la ronda!' : '¡Ronda ganadora!')
    : win ? '¡Partida ganada!' : move.clean ? '¡Caída y limpia!' : '¡Caída!';
  const cardId = view.lastEvent?.kind === 'ronda-victory'
    ? (locked ? undefined : view.rondas?.[view.winner]?.cardIds[0])
    : view.lastEvent?.kind === 'four-kind' ? undefined : move?.cardId;
  const card = impactCards.get(cardId);
  return renderImpact(app.querySelector('.game-table'), kind, caption, card);
}

const animateTable = () => !document.hidden && !prefs.reducedMotion && !systemReducedMotion.matches;

function renderImpact(target, kind, caption, card) {
  if (!target || !animateTable()) return 0;
  const impact = document.createElement('div');
  impact.className = `play-impact play-impact--${kind}`;
  impact.setAttribute('aria-hidden', 'true');
  impact.innerHTML = `
    <span class="impact-rays"></span><span class="impact-ring"></span>
    <span class="impact-particles">${Array.from({ length: 10 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>
    <span class="impact-hand">
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <path d="M36 95 25 74C18 68 12 61 8 52c-2-5 3-10 8-7l13 9L20 22c-2-6 5-10 9-5l12 24L35 12c-1-7 7-9 10-3l9 27-1-25c0-6 8-7 10-1l6 27 5-16c2-6 10-5 10 2l-3 34c0 12-4 23-12 30l-5 8Z" fill="currentColor"/>
      </svg>
    </span>
    <span class="impact-card">${cardMarkup(card, { back: !card })}</span>
    <span class="impact-caption">${caption}</span>`;
  target.append(impact);
  setTimeout(() => impact.remove(), 1080);
  return 1080;
}

function presentGameStatus(move) {
  const view = getView();
  if (!view || modal.open) return;
  const delay = showPlayImpact(view, move);
  if (view.status === 'playing') {
    const dealing = app.querySelector('.game-table.is-dealing') && animateTable();
    scheduleBot(Math.max(delay, dealing ? 660 : 0));
    return;
  }
  const showStatus = () => {
    const current = getView();
    if (screen !== 'game' || modal.open || current?.id !== view.id || current.revision !== view.revision) return;
    if (view.status === 'round-end') showRoundSummary();
    else if (view.status === 'finished') showResult();
  };
  if (delay) setTimeout(showStatus, delay);
  else showStatus();
}

function renderCapture(move, actor, center = app.querySelector('.table-center')) {
  if (!center || !move || move.fall || !move.captureIds.length) return 0;
  const receipt = document.createElement('span');
  receipt.className = 'capture-receipt';
  receipt.setAttribute('aria-hidden', 'true');
  receipt.innerHTML = `${icon('cards')} ${move.clean ? '¡Limpia! · ' : ''}+${move.captureIds.length + 1} cartas`;
  center.append(receipt);
  const animated = animateTable();
  if (animated) {
    // Only the card that was publicly played is shown in the moving pile.
    const stack = document.createElement('div');
    stack.className = `capture-stack${actor !== viewer ? ' is-rival' : ''}`;
    stack.setAttribute('aria-hidden', 'true');
    stack.innerHTML = cardMarkup(impactCards.get(move.cardId));
    center.append(stack);
    setTimeout(() => stack.remove(), 900);
  }
  setTimeout(() => receipt.remove(), animated ? 900 : 950);
  return animated ? 900 : 0;
}

function afterMove(move, actor) {
  selectedId = null; selectedMoveIndex = 0;
  const v = getView();
  if (v.mode === 'pass' && v.status === 'playing') locked = true;
  pendingPassMove = locked ? { id: v.id, revision: v.revision, move, actor } : null;
  const message = locked && v.lastEvent?.kind === 'ronda' ? 'Nuevo reparto.' : v.lastEvent?.text;
  announce(message || 'Jugada realizada.'); playSound(move.points);
  pendingCardArrival = !locked && move.captureIds.length === 0;
  render();
  if (!locked && v.status === 'playing') renderCapture(move, actor);
  presentGameStatus(locked ? undefined : move);
}

function startGame(options) {
  cancelBot(); closeModal(false);
  try {
    session.dispatch({ type: 'NEW_GAME', options });
    pendingPassMove = null;
    screen = 'game'; mode = options.mode; difficulty = options.difficulty || 'medium'; viewer = 0; locked = mode === 'pass'; selectedId = null;
    render(); focusGame(); announce('Partida iniciada.');
    presentGameStatus();
    if (session.warning) toast(session.warning);
  } catch (error) { toast(error.message); }
}

function readForm() {
  const clean = (id, fallback) => (document.getElementById(id)?.value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20) || fallback;
  const names = [clean('player-name', 'Tú'), clean('opponent-name', mode === 'solo' ? DEFAULT_BOT_NAME : 'Jugador 2')];
  if (names[0] === names[1]) names[1] = names[1].slice(0, 17) + ' 2';
  return { mode, names, comboPoints, difficulty };
}

function showModal(kind, content) {
  cancelBot();
  if (!modal.open) lastFocus = document.activeElement;
  modalKind = kind;
  modal.innerHTML = content;
  if (!modal.open) modal.showModal();
}

function closeModal(resume = true) {
  if (modal.open) modal.close();
  modalKind = null;
  if (lastFocus?.isConnected) lastFocus.focus();
  if (resume) scheduleBot();
}

function modalHeader(title, eyebrow = 'EN TU MESA') {
  return `<div class="modal-top"><p class="eyebrow">${eyebrow}</p><button class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon('close')}</button></div><h2 id="modal-title">${title}</h2>`;
}

function showRules() {
  const v = screen === 'game' ? getView() : null;
  const old = legacyRules(v);
  const points = v?.rules.comboPoints ?? comboPoints;
  const rondaText = old ? 'Tres iguales al repartir dan 2 puntos solo si tienes menos de 30. Esta partida guardada mantiene el perfil anterior, sin victoria por caída a la ronda.' : 'Tres cartas del mismo valor al repartir forman una ronda y suman 2 puntos automáticamente, incluso desde 30 o 38. Si esos puntos llevan a 40, ganas. Cuatro iguales tienen prioridad y ganan directamente. Si ambos alcanzan 40 por ronda en el mismo reparto, gana el asiento que empieza.';
  showModal('rules', `${modalHeader('Las reglas, sobre la mesa.', old ? 'PERFIL LOCAL V1 · PARTIDA ANTERIOR' : 'PERFIL LOCAL V2 · RONDA GANADORA')}<p class="modal-intro">Una chica a 40 puntos, con 40 cartas y cinco cartas por reparto. Las reglas se fijan al comenzar.</p><div class="rule-scores"><div><strong>2</strong><span>Caída</span></div><div><strong>2</strong><span>Ronda</span></div><div><strong>${points}</strong><span>Caída y limpia</span></div></div>${old ? '' : '<p class="rule-callout">Caída a la ronda = victoria inmediata, sin necesitar 40 puntos.</p>'}<div class="rules-list"><details open><summary>Ronda: tres cartas iguales</summary><p>${rondaText} El valor de tu ronda solo se muestra en tu mano.</p></details>${old ? '' : '<details open><summary>Caída a la ronda: partida ganada</summary><p>Si tu rival juega una de las tres cartas originales de su ronda y tú la capturas por igualdad en el turno inmediato siguiente, ganas. Puede ser la primera, segunda o tercera carta de esa ronda. Debe ser el mismo reparto: recogerla por suma, incluirla en una escalera o capturarla más tarde no da esta victoria.</p></details>'}<details><summary>Capturas, caída y limpia</summary><p>Iguala una carta de la mesa o suma exactamente dos cartas numéricas para obtener el valor de la tuya. Por ejemplo, con un 6 recoges 2 + 4; A + 2 + 3 no es una suma válida. Elige una sola base de captura y completa su escalera: A, 2, 3, 4, 5, 6, 7, J, Q, K. Si falta un valor, termina. Las figuras no se suman. Caer a la carta del turno rival anterior da 2 puntos. La limpia deja la mesa vacía y da 2; juntas valen ${points}.</p></details><details><summary>Cartón y cartas que sobran</summary><p>20 cartas recogidas dan 6 puntos. Cada carta adicional suma uno, redondeando a par. El cartón solo suma hasta 30. En empate, 2 puntos al siguiente repartidor. Si ambos tienen menos de 20 sin empatar, nadie cobra. Las sobrantes se descartan.</p></details><details><summary>El cierre desde 38</summary><p>En las jugadas, desde 38 solo puntúa una caída, no una limpia. ${old ? '' : 'Una nueva ronda también suma sus 2 puntos y cierra la partida. La caída a una ronda gana con cualquier marcador.'} Cuatro iguales al repartir ganan automáticamente; si ambos los reciben, se repite ese reparto.</p></details><details><summary>Cuatro niveles, las mismas reglas</summary><p>Fácil elige jugadas legales al azar. Medio prioriza puntos y capturas. Difícil evalúa respuestas inmediatas y cuida sus cartas de ronda. Experto compara hasta 12 jugadas priorizadas y 8 respuestas probables del rival, y calcula una contra-jugada con las cartas que conserva. La retroalimentación local puede ampliar o reducir esta búsqueda. No recibe la mano rival ni el orden del mazo. Su búsqueda es heurística y no garantiza la victoria.</p></details><details><summary>Esta edición local</summary><p>Sin reloj ni penalizaciones por esperar. Juega contra la máquina o comparte el dispositivo, ocultando las manos entre turnos. El guardado pertenece a este navegador.</p></details></div><button class="button primary full-width" data-action="close-modal">Todo claro ${icon('check')}</button>`);
}

function applyFelt() {
  document.documentElement.dataset.felt = prefs.feltTheme;
  document.documentElement.style.setProperty('--felt-custom', prefs.feltColor);
}

function refreshFeltPicker() {
  for (const button of modal.querySelectorAll('[data-action="felt-theme"]')) {
    button.setAttribute('aria-pressed', String(button.dataset.felt === prefs.feltTheme));
  }
  const custom = modal.querySelector('.felt-custom-control');
  if (custom) custom.dataset.active = String(prefs.feltTheme === 'custom');
  const value = modal.querySelector('#felt-color-value');
  if (value) value.textContent = prefs.feltColor.toUpperCase();
  const preview = modal.querySelector('#felt-active-name');
  if (preview) preview.textContent = feltNames[prefs.feltTheme];
}

function setFelt(theme, color = prefs.feltColor, persist = true) {
  if (!FELT_THEMES.includes(theme)) return;
  prefs.feltTheme = theme;
  prefs.feltColor = normalizeFeltColor(color);
  applyFelt();
  refreshFeltPicker();
  if (persist && !savePreferences(prefs)) toast('No se pudo guardar el color en este navegador.');
}

function feltSettings() {
  const presetButtons = FELT_THEMES.filter(theme => theme !== 'custom').map(theme =>
    `<button type="button" class="felt-option" data-action="felt-theme" data-felt="${theme}" aria-pressed="${theme === prefs.feltTheme}"><span class="felt-swatch" data-felt-option="${theme}" aria-hidden="true"></span><span>${feltNames[theme]}</span></button>`
  ).join('');
  return `<section class="felt-settings" aria-labelledby="felt-settings-title">
    <h3 id="felt-settings-title">Color de la mesa</h3>
    <p>Elige un tapete o crea el tuyo.</p>
    <div class="felt-preview"><span id="felt-active-name">${feltNames[prefs.feltTheme]}</span></div>
    <div class="felt-options" role="group" aria-label="Paletas de la mesa">${presetButtons}</div>
    <div class="felt-custom-control" data-active="${prefs.feltTheme === 'custom'}">
      <button type="button" class="felt-use-custom" data-action="felt-theme" data-felt="custom" aria-pressed="${prefs.feltTheme === 'custom'}">${icon('palette')} <span><strong>Mi propio color</strong><small id="felt-color-value">${prefs.feltColor.toUpperCase()}</small></span></button>
      <input type="color" id="felt-color" value="${prefs.feltColor}" aria-label="Elegir color personalizado">
    </div>
  </section>`;
}

function musicSettings() {
  const volume = Math.round(prefs.musicVolume * 100);
  const tracks = MUSIC_TRACKS.map(({ id, title }) =>
    `<option value="${esc(id)}"${id === prefs.musicTrack ? ' selected' : ''}>${esc(title)}</option>`
  ).join('');
  return `<section class="music-settings" aria-labelledby="music-settings-title">
    <h3 id="music-settings-title">Música de fondo</h3>
    <label class="preference-row music-toggle-row">
      <span><strong>Reproducir música</strong><small>Pasillos instrumentales originales</small></span>
      <input type="checkbox" id="music-enabled"${prefs.music ? ' checked' : ''}>
      <span class="switch" aria-hidden="true"></span>
    </label>
    <div class="music-options">
      <label for="music-track">Pista<select id="music-track">${tracks}</select></label>
      <div class="music-volume">
        <label for="music-volume">Volumen</label><output id="music-level" for="music-volume">${volume}%</output>
        <input type="range" id="music-volume" min="0" max="100" value="${volume}">
      </div>
    </div>
    <p class="music-status" id="music-status" role="status" hidden></p>
  </section>`;
}

function showSettings(focusFelt = false) {
  const adjustment = prefs.feedbackChallenge > 0 ? 'más difícil' : prefs.feedbackChallenge < 0 ? 'más accesible' : 'estándar';
  showModal('settings', `${modalHeader('A tu manera.', 'PREFERENCIAS')}${feltSettings()}${musicSettings()}<div class="preference-list">${[['sound', 'Sonidos de la mesa', 'Un toque suave al jugar y puntuar.'], ['reducedMotion', 'Reducir movimiento', systemReducedMotion.matches ? 'Tu dispositivo tiene activada la reducción de movimiento.' : 'Desactiva las animaciones de la mesa.'], ['quickBot', 'Máquina más rápida', 'Menos espera entre jugadas.'], ['feedbackMode', 'Retroalimentación del Experto', 'Al final de cada partida Experto puedes valorar el reto.']].map(([key, title, sub]) => `<label class="preference-row"><span><strong>${title}</strong><small>${sub}</small></span><input type="checkbox" data-preference="${key}" ${prefs[key] ? 'checked' : ''}><span class="switch" aria-hidden="true"></span></label>`).join('')}</div><p class="preferences-note">Ajuste actual del reto: ${adjustment}. Se guarda en este navegador.${prefs.feedbackChallenge ? ' <button class="button text-button" data-action="reset-feedback">Restablecer ajuste</button>' : ''}</p><button class="button primary full-width" data-action="close-modal">Volver a la mesa ${icon('arrow')}</button>`);
  if (focusFelt) modal.querySelector('[data-action="felt-theme"][aria-pressed="true"]')?.focus({ preventScroll: true });
}

function shouldAskBotFeedback(v) {
  return Boolean(v && prefs.feedbackMode && v.mode === 'solo' && v.difficulty === 'expert' && feedbackCompletedMatchId !== v.id);
}

function completeBotFeedback(matchId) {
  if (!matchId) return;
  feedbackCompletedMatchId = matchId;
  try { globalThis.localStorage?.setItem(FEEDBACK_MATCH_KEY, matchId); }
  catch { /* Keep the choice for this open page even when storage is unavailable. */ }
}

function rateBot(rating) {
  if (rating === 'too-easy') prefs.feedbackChallenge = Math.min(3, prefs.feedbackChallenge + 1);
  else if (rating === 'too-hard') prefs.feedbackChallenge = Math.max(-3, prefs.feedbackChallenge - 1);
  const saved = savePreferences(prefs);
  completeBotFeedback(session.view(0)?.id);
  showResult();
  const adjustment = prefs.feedbackChallenge > 0 ? 'El Experto analizará más variantes.' : prefs.feedbackChallenge < 0 ? 'El Experto analizará menos variantes.' : 'El Experto mantiene su búsqueda estándar.';
  toast(saved ? `Gracias por tu valoración. ${adjustment}` : 'Gracias por tu valoración; no se pudieron guardar los ajustes en este navegador.');
}

function resetTutorialAttempt() {
  tutorialCardId = null;
  tutorialCaptures.clear();
  tutorialFeedback = '';
}

function openTutorial(restart = false) {
  const points = (screen === 'game' ? getView()?.rules.comboPoints : comboPoints) ?? 2;
  if (restart || points !== tutorialComboPoints) {
    tutorialLessons = createTutorialLessons(points);
    tutorialComboPoints = points;
    tutorialSolved.clear();
    tutorialStep = 0;
    tutorialComplete = false;
    resetTutorialAttempt();
  }
  showTutorial('#modal-title');
}

function showTutorial(focus, keepScroll = false) {
  const scroll = modal.open && modalKind === 'tutorial' ? modal.scrollTop : 0;
  const lesson = tutorialLessons[tutorialStep];
  const total = tutorialLessons.length;
  if (tutorialComplete) {
    showModal('tutorial', `${modalHeader('¡Listo para la mesa!', 'RETO COMPLETADO')}<div class="tutorial-game"><div class="winner-symbol">${icon('trophy')}</div><p class="tutorial-feedback" data-tone="correct">${total} de ${total} retos resueltos. Ya puedes poner en práctica las capturas, las rondas y el cierre.</p><div class="lesson-navigation tutorial-actions"><button class="button outline" data-action="tutorial-restart">Repetir retos</button><button class="button primary" data-action="close-modal">Volver a la mesa ${icon('arrow')}</button></div></div>`);
  } else {
    const answer = tutorialSolved.get(tutorialStep);
    const play = lesson.type === 'play';
    const hand = answer?.after?.hand ?? lesson.hand;
    const table = answer?.after?.table ?? lesson.table;
    const lastCard = answer ? (answer.after?.move?.kind === 'drop' ? answer.after.move.cardId : null) : lesson.lastCardId;
    const board = lesson.hand.length || lesson.table.length ? `<div class="lesson-board tutorial-board${answer ? ' is-solved' : ''}">
      <p class="tutorial-zone-label">${answer?.after?.move ? 'MESA DESPUÉS DE JUGAR' : lastCard ? 'MESA · ÚLTIMA CARTA MARCADA' : 'EN LA MESA'}</p>
      <div class="tutorial-table">${table.map(card => cardMarkup(card, {
        highlight: !answer && tutorialCaptures.has(card.id), selected: !answer && tutorialCaptures.has(card.id), last: card.id === lastCard,
        interactive: play && !!tutorialCardId && !answer, action: 'tutorial-capture',
      })).join('') || '<span class="tutorial-empty">Mesa vacía</span>'}</div>
      <p class="tutorial-zone-label">TU MANO</p>
      <div class="tutorial-hand">${hand.map(card => cardMarkup(card, {
        selected: !answer && card.id === tutorialCardId, interactive: play && !answer, action: 'tutorial-card',
      })).join('') || '<span class="tutorial-empty">Sin cartas</span>'}</div>
    </div>` : '';
    const choices = !play && !answer ? `<div class="tutorial-capture-options">${lesson.choices.map(choice =>
      `<button type="button" class="button outline" data-action="tutorial-answer" data-answer="${esc(choice.id)}">${esc(choice.label)}</button>`
    ).join('')}</div>` : '';
    const scores = answer?.after?.scores ?? lesson.scores;
    const gained = scores && lesson.scores ? scores[0] - lesson.scores[0] : 0;
    const score = Array.isArray(scores) ? `<p class="tutorial-scoreline">Tú <strong>${esc(scores[0])}</strong>${gained > 0 ? ` <span class="tutorial-score-gain">+${gained}</span>` : ''} · Rival <strong>${esc(scores[1])}</strong></p>` : '';
    const progress = tutorialLessons.map((item, index) =>
      `<button type="button" data-action="tutorial-step" data-step="${index}" data-solved="${tutorialSolved.has(index)}" aria-label="${index + 1}. ${esc(item.title)}${tutorialSolved.has(index) ? ', resuelto' : ''}" ${index === tutorialStep ? 'aria-current="step"' : ''} ${index > tutorialSolved.size ? 'disabled' : ''}>${index + 1}</button>`
    ).join('');
    const feedback = answer ? lesson.explanation : tutorialFeedback || (play
      ? (tutorialCardId ? 'Marca las cartas que recogerías y confirma tu jugada.' : 'Primero toca una carta de tu mano.')
      : 'Elige una respuesta para seguir.');
    const tone = answer ? 'correct' : tutorialFeedback ? 'retry' : 'neutral';
    const savedLegacy = screen === 'game' && legacyRules(getView());
    const goal = lesson.goal && lesson.goal !== lesson.prompt ? `<p class="tutorial-goal">${esc(lesson.goal)}</p>` : '';
    const setup = tutorialStep === 0 ? '<details class="tutorial-setup"><summary>Cómo se reparte y se juega</summary><p>Se juega entre dos con 40 cartas: A, 2, 3, 4, 5, 6, 7, J, Q y K de cada palo. Reciben cinco cartas cada uno y empieza quien no reparte. Juegan una carta por turno. Tras cuatro repartos se cuenta el cartón y se cambia de repartidor. La meta es llegar a 40 puntos, salvo las victorias inmediatas que practicarás más adelante.</p></details>' : '';
    showModal('tutorial', `${modalHeader(esc(lesson.title), `APRENDE JUGANDO · ${tutorialStep + 1} DE ${total}`)}
      <div class="tutorial-game">
        <nav class="tutorial-progress" aria-label="Lecciones">${progress}</nav>
        ${setup}
        <p class="modal-intro">${esc(lesson.prompt)}</p>${goal}
        ${savedLegacy ? '<p class="legacy-note">Estos retos usan las reglas V2. Tu partida guardada conserva el reglamento V1.</p>' : ''}
        ${score}${board}${choices}
        <div class="tutorial-feedback" id="tutorial-feedback" data-tone="${tone}" role="status" tabindex="-1">${answer ? `<strong>${icon('check')} ¡Bien jugado!</strong> ` : ''}${esc(feedback)}</div>
        <div class="lesson-navigation tutorial-actions">
          <button type="button" class="button outline" data-action="tutorial-prev" ${tutorialStep === 0 ? 'disabled' : ''}>${icon('back')} Anterior</button>
          ${answer
            ? `<button type="button" class="button primary" data-action="tutorial-next">${tutorialStep + 1 === total ? 'Terminar práctica' : 'Siguiente reto'} ${icon('arrow')}</button>`
            : play ? `<button type="button" class="button primary" data-action="tutorial-play" ${tutorialCardId ? '' : 'disabled'}>Confirmar jugada ${icon('arrow')}</button>` : ''}
        </div>
      </div>`);
  }
  const progressStrip = modal.querySelector('.tutorial-progress');
  const currentStep = progressStrip?.querySelector('[aria-current="step"]');
  if (currentStep) progressStrip.scrollLeft = currentStep.offsetLeft - (progressStrip.clientWidth - currentStep.offsetWidth) / 2;
  if (focus === '#modal-title') modal.querySelector(focus).tabIndex = -1;
  modal.scrollTop = focus === '#modal-title' ? 0 : scroll;
  if (focus) modal.querySelector(focus)?.focus({ preventScroll: keepScroll || focus !== '#tutorial-feedback' });
}

function selectTutorialStep(step) {
  if (!Number.isInteger(step) || step < 0 || step >= tutorialLessons.length || step > tutorialSolved.size) return;
  tutorialStep = step;
  resetTutorialAttempt();
  showTutorial('#modal-title');
}

function selectTutorialCard(cardId, fromTable) {
  const lesson = tutorialLessons[tutorialStep];
  if (!lesson || lesson.type !== 'play' || tutorialSolved.has(tutorialStep)) return;
  if (fromTable) {
    if (!tutorialCardId || !lesson.table.some(card => card.id === cardId)) return;
    if (tutorialCaptures.has(cardId)) tutorialCaptures.delete(cardId);
    else tutorialCaptures.add(cardId);
  } else {
    if (!lesson.hand.some(card => card.id === cardId)) return;
    if (tutorialCardId !== cardId) tutorialCaptures.clear();
    tutorialCardId = cardId;
  }
  tutorialFeedback = '';
  const action = fromTable ? 'tutorial-capture' : 'tutorial-card';
  showTutorial(`[data-action="${action}"][data-card="${CSS.escape(cardId)}"]`);
}

function checkTutorialAnswer(answerId) {
  const lesson = tutorialLessons[tutorialStep];
  if (!lesson || tutorialSolved.has(tutorialStep)) return;
  if (lesson.type === 'play' && !tutorialCardId) return;
  const answer = lesson.type === 'play' ? lesson.choices.find(choice =>
    choice.cardId === tutorialCardId &&
    choice.captureIds.length === tutorialCaptures.size &&
    choice.captureIds.every(id => tutorialCaptures.has(id))
  ) : lesson.choices.find(choice => choice.id === answerId);
  if (!answer?.correct) {
    tutorialFeedback = answer?.feedback || 'Esa combinación no cumple el reto. Revisa el valor de tu carta y marca solo las que corresponden.';
    showTutorial('#tutorial-feedback');
    return;
  }
  tutorialSolved.set(tutorialStep, answer);
  const animated = animateTable() && (lesson.hand.length || lesson.table.length);
  showTutorial('#tutorial-feedback', animated);
  const event = answer.after?.event?.kind;
  const special = event === 'ronda-fall' || event === 'ronda-victory';
  const win = answer.after?.status === 'finished';
  const move = answer.after?.move;
  const fall = move?.fall;
  const label = special ? '¡Ronda ganadora!' : win ? '¡Cierre perfecto!' : move?.clean ? '¡Caída y limpia!' : '¡Caída!';
  const board = modal.querySelector('.tutorial-board');
  const duration = win || fall
    ? renderImpact(board, special ? 'ronda' : win ? 'win' : 'fall', label, impactCards.get(move?.cardId))
    : renderCapture(move, viewer, board);
  if (duration && (board.offsetTop < modal.scrollTop || board.offsetTop + board.offsetHeight > modal.scrollTop + modal.clientHeight)) {
    modal.scrollTop = Math.max(0, board.offsetTop - 12);
  }
}

function advanceTutorial() {
  if (!tutorialSolved.has(tutorialStep)) return;
  if (tutorialStep + 1 < tutorialLessons.length) {
    selectTutorialStep(tutorialStep + 1);
    return;
  }
  tutorialComplete = true;
  showTutorial('#modal-title');
}

function showRoundSummary() {
  const v = getView(); if (v.status !== 'round-end') return;
  const summary = v.roundSummary;
  showModal('round', `${modalHeader('Contemos el cartón.', `FIN DEL CICLO ${v.round}`)}<p class="modal-intro">${summary?.leftover || 0} cartas quedaron sobre la mesa y se descartan. El cartón suma hasta un máximo de 30 puntos.</p><div class="round-results">${v.players.map((p, i) => `<div><span>${esc(p.name)}</span><strong>${summary?.captured?.[i] ?? p.capturedCount}<small>cartas recogidas</small></strong><p>Base ${summary?.base?.[i] ?? 0} · Cobras <b>+${summary?.awarded?.[i] ?? 0}</b></p><div class="round-total">${p.score} / 40</div></div>`).join('')}</div><button class="button primary full-width" data-action="next-round">Barajar y seguir ${icon('arrow')}</button>`);
}

function showResult() {
  const v = getView(); if (v.status !== 'finished') return;
  const feedback = shouldAskBotFeedback(v) ? `<section class="end-feedback" aria-label="Retroalimentación de la partida"><p class="eyebrow">CIERRE DE PARTIDA · EXPERTO</p><h3>¿Cómo estuvo el reto del Experto en esta partida?</h3><p class="modal-intro">Tu respuesta ajusta la dificultad de las próximas partidas en este navegador.</p><div class="feedback-options"><button class="button feedback-option" data-action="feedback-rating" data-rating="too-easy"><strong>Demasiado fácil</strong><small>Aumentar el reto</small></button><button class="button feedback-option" data-action="feedback-rating" data-rating="good"><strong>Buen reto</strong><small>Mantener el ajuste</small></button><button class="button feedback-option" data-action="feedback-rating" data-rating="too-hard"><strong>Demasiado difícil</strong><small>Hacerlo más accesible</small></button></div><button class="button text-button full-width" data-action="skip-feedback">Omitir valoración</button></section>` : '';
  showModal('result', `${modalHeader('¡Chica ganada!', 'UNA BUENA PARTIDA')}<div class="winner-symbol">${icon('trophy')}</div><h3 class="winner-name">${esc(v.players[v.winner]?.name || 'La mesa')}</h3><p class="winner-subtitle">${esc(v.lastEvent?.text || 'Llegó el momento de volver a repartir.')}</p><div class="final-score">${v.players.map(p => `<div><strong>${p.score}</strong><span>${esc(p.name)}</span></div>`).join('<span class="score-divider">:</span>')}</div>${feedback}<button class="button primary full-width" data-action="rematch">Una revancha ${icon('cards')}</button><button class="button text-button full-width" data-action="home">Volver al inicio</button>`);
}

function handleAction(target) {
  const action = target.dataset.action;
  if (action === 'home') { cancelBot(); closeModal(false); screen = 'home'; selectedId = null; pendingPassMove = null; render(); }
  else if (action === 'mode') {
    if (mode === target.dataset.mode) return;
    mode = target.dataset.mode;
    render();
    app.querySelector(`[data-mode="${mode}"]`)?.focus({ preventScroll: true });
  }
  else if (action === 'combo') {
    comboPoints = Number(target.dataset.points);
    for (const button of app.querySelectorAll('[data-action="combo"]')) {
      const selected = Number(button.dataset.points) === comboPoints;
      button.classList.toggle('chosen', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }
  else if (action === 'resume') { screen = 'game'; viewer = 0; locked = session.view(0).mode === 'pass'; render(); focusGame(); presentGameStatus(); }
  else if (action === 'table-layout') changeTableLayout(target.dataset.layout);
  else if (action === 'reveal') {
    const v = getView();
    viewer = v.turn;
    const effect = pendingPassMove?.id === v.id && pendingPassMove.revision === v.revision ? pendingPassMove : null;
    pendingPassMove = null;
    locked = false;
    pendingCardArrival = Boolean(effect && !effect.move.captureIds.length);
    render();
    if (effect) {
      renderCapture(effect.move, effect.actor);
      presentGameStatus(effect.move);
    }
    announce(`Turno de ${v.players[viewer].name}.`);
  }
  else if (action === 'select-card') { selectedId = target.dataset.card; selectedMoveIndex = 0; render(); document.querySelector(`[data-card="${CSS.escape(selectedId)}"]`)?.focus(); }
  else if (action === 'next-capture') { selectedMoveIndex++; const moves = legalMoves(getView(), viewer).filter(m => m.cardId === selectedId); selectedMoveIndex %= moves.length; render(); }
  else if (action === 'play') {
    const v = getView(); const move = legalMoves(v, viewer).filter(m => m.cardId === selectedId)[selectedMoveIndex];
    if (!move || locked) return;
    try { session.dispatch({ type: 'PLAY', move: { ...move, playerId: viewer, expectedRevision: v.revision } }); afterMove(move, viewer); }
    catch (error) { toast(error.message); selectedId = null; render(); }
  }
  else if (action === 'next-round') { closeModal(false); try { session.dispatch({ type: 'NEXT_ROUND' }); locked = mode === 'pass'; selectedId = null; render(); presentGameStatus(); } catch (error) { toast(error.message); } }
  else if (action === 'rules') showRules();
  else if (action === 'settings') showSettings();
  else if (action === 'felt-settings') showSettings(true);
  else if (action === 'felt-theme') setFelt(target.dataset.felt);
  else if (action === 'feedback-rating') rateBot(target.dataset.rating);
  else if (action === 'skip-feedback') { completeBotFeedback(getView()?.id); showResult(); }
  else if (action === 'reset-feedback') { prefs.feedbackChallenge = 0; savePreferences(prefs); showSettings(); }
  else if (action === 'tutorial') openTutorial();
  else if (action === 'tutorial-restart') openTutorial(true);
  else if (action === 'tutorial-step') selectTutorialStep(Number(target.dataset.step));
  else if (action === 'tutorial-prev') selectTutorialStep(tutorialStep - 1);
  else if (action === 'tutorial-next') advanceTutorial();
  else if (action === 'tutorial-card') selectTutorialCard(target.dataset.card, false);
  else if (action === 'tutorial-capture') selectTutorialCard(target.dataset.card, true);
  else if (action === 'tutorial-play' || action === 'tutorial-answer') checkTutorialAnswer(target.dataset.answer);
  else if (action === 'close-modal') closeModal();
  else if (action === 'music') toggleMusic(!prefs.music);
  else if (action === 'sound') { prefs.sound = !prefs.sound; savePreferences(prefs); playSound(2); render(); }
  else if (action === 'new') showModal('new', `${modalHeader('¿Volvemos a repartir?')}<p class="modal-intro">Volverás a elegir el modo de juego. Tu partida actual seguirá guardada hasta que inicies otra.</p><button class="button primary full-width" data-action="home">Ir al inicio ${icon('arrow')}</button><button class="button text-button full-width" data-action="close-modal">Seguir esta partida</button>`);
  else if (action === 'round-summary') showRoundSummary();
  else if (action === 'result') showResult();
  else if (action === 'rematch') { const v = getView(); startGame({ mode: v.mode, names: v.players.map(p => p.name), comboPoints: v.rules.comboPoints, difficulty: v.difficulty || 'medium' }); }
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) handleAction(button);
  // A remembered setting can resume after the first user gesture on this page.
  if (event.isTrusted && prefs.music && !tableMusic.isPlaying &&
      !event.target.closest('[data-action="music"], .music-toggle-row, #music-track')) startMusic();
});
document.addEventListener('input', event => {
  if (event.target.id === 'player-name') draftNames.player = event.target.value;
  else if (event.target.id === 'opponent-name') draftNames[mode] = event.target.value;
  else if (event.target.id === 'felt-color') setFelt('custom', event.target.value, false);
  else if (event.target.id === 'music-volume') {
    const volume = event.target.valueAsNumber;
    prefs.musicVolume = volume / 100;
    tableMusic.setVolume(prefs.musicVolume);
    modal.querySelector('#music-level').value = `${volume}%`;
  }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'new-game-form') return;
  event.preventDefault();
  const options = readForm();
  const prior = session.view(0);
  if (prior && prior.status !== 'finished') {
    showModal('replace', `${modalHeader('Una nueva partida.')}<p class="modal-intro">Empezar reemplazará la partida guardada de ${esc(prior.players[0].name)} y ${esc(prior.players[1].name)}. ¿Repartimos de nuevo?</p><button id="confirm-new" class="button primary full-width">Sí, repartir cartas ${icon('cards')}</button><button class="button text-button full-width" data-action="close-modal">Conservar la partida</button>`);
    document.querySelector('#confirm-new').addEventListener('click', () => startGame(options), { once: true });
  } else startGame(options);
});
document.addEventListener('change', event => {
  if (event.target.id === 'music-enabled') {
    toggleMusic(event.target.checked);
    return;
  }
  if (event.target.id === 'music-track' || event.target.id === 'music-volume') {
    if (event.target.id === 'music-track') {
      if (!MUSIC_TRACKS.some(track => track.id === event.target.value)) return;
      prefs.musicTrack = event.target.value;
      if (prefs.music) startMusic(true);
    }
    if (!savePreferences(prefs)) toast('No se pudo guardar la configuración de música.');
    return;
  }
  if (event.target.id === 'felt-color') {
    setFelt('custom', event.target.value);
    return;
  }
  if (event.target.id === 'bot-difficulty') {
    if (Object.hasOwn(difficultyNames, event.target.value)) difficulty = event.target.value;
    document.querySelector('#difficulty-note').textContent = difficultyNotes[difficulty];
    return;
  }
  const key = event.target.dataset.preference;
  if (!key || !Object.hasOwn(prefs, key)) return;
  prefs[key] = event.target.checked;
  if (!savePreferences(prefs)) toast('No se pudieron guardar las preferencias.');
  document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion);
  if (key === 'sound') playSound(2);
  render();
});
modal.addEventListener('cancel', event => { event.preventDefault(); closeModal(); });
landscapeGame.addEventListener('change', updateGameOrientation);
window.addEventListener('resize', updateGameOrientation);
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    rotationOwnsFullscreen = false;
    rotationOwnsLock = false;
  }
  updateGameOrientation();
});
function resumeMusic() {
  if (musicActivated && prefs.music && audioContext?.state === 'running') startMusic();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelBot(); pauseMusic(); }
  else { scheduleBot(); resumeMusic(); }
});
window.addEventListener('pagehide', () => { cancelBot(); pauseMusic(); });
window.addEventListener('pageshow', event => { if (event.persisted) resumeMusic(); });
render();
if (session.warning) toast(session.warning);
