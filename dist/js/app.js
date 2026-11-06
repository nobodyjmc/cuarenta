import { legalMoves } from './engine.js';
import { chooseBotMove } from './bot.js';
import { cardSvg, cardBackSvg, cardLabel } from './cards.js';
import { LocalSession, loadPreferences, savePreferences } from './session.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const session = new LocalSession();
const prefs = loadPreferences();
let screen = 'home';
let mode = 'solo';
let comboPoints = 2;
let difficulty = 'medium';
const difficultyNames = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil', expert: 'Experto' };
const tableLayouts = { horizontal: 'Horizontal', vertical: 'Vertical' };
const difficultyNotes = {
  easy: 'Una mesa tranquila: la máquina elige jugadas al azar.',
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
let tutorialStep = 0;
let tutorialRevealed = false;
let modalKind = null;
let lastFocus = null;
let audioContext = null;
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
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m2 3c3 1 3 3 3 6"/>',
  bot: '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 12v4m22-4v4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3c0 3 2 5 5 5m9-8h4v3c0 3-2 5-5 5M12 15v6m-5 0h10"/>',
  save: '<path d="M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.cards}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const demoCard = (rank, suit) => ({ id: `${rank}-${suit}`, rank, suit });
const getView = () => session.view(viewer);

function cardMarkup(card, { back = false, selected = false, highlight = false, interactive = false, last = false } = {}) {
  const tag = interactive ? 'button' : 'div';
  return `<${tag} class="playing-card ${back ? 'card-back' : ''} ${selected ? 'selected' : ''} ${highlight ? 'highlight' : ''} ${last ? 'last-card' : ''}" ${interactive ? `type="button" data-action="select-card" data-card="${esc(card.id)}" aria-label="${esc(cardLabel(card))}" aria-pressed="${selected}"` : `aria-label="${back ? 'Carta oculta' : esc(cardLabel(card))}" role="img"`}>${back ? cardBackSvg() : cardSvg(card)}</${tag}>`;
}

function shell(content) {
  return `<div class="app-shell${screen === 'game' ? ' is-playing' : ''}">
    <aside class="sidebar" aria-label="Menú principal">
      <button class="brand" data-action="home" aria-label="Cuarenta, inicio"><span class="brand-mark">40<span>◆</span></span><span class="brand-word">cuarenta<span>DE AQUÍ, DE SIEMPRE</span></span></button>
      <nav><button class="nav-item active" data-action="home">${icon('cards')}<span>La mesa</span></button><button class="nav-item" data-action="tutorial">${icon('book')}<span>Aprender a jugar</span></button><button class="nav-item" data-action="settings">${icon('settings')}<span>Preferencias</span></button></nav>
      <div class="sidebar-bottom"><span class="ecuador-stripes" aria-hidden="true"><i></i><i></i><i></i></span><span>Una tradición ecuatoriana.<br>Una mesa para todos.</span></div>
    </aside>
    <div class="main-shell"><header class="topbar"><div class="breadcrumb">${screen === 'home' ? 'Bienvenido a tu mesa' : `<button data-action="home">La mesa</button><span>/</span><strong>Partida local</strong>`}</div><div class="topbar-actions"><span class="local-badge"><i></i> En este dispositivo</span><button class="icon-button sound-toggle" data-action="sound" aria-label="${prefs.sound ? 'Desactivar' : 'Activar'} sonido" title="${prefs.sound ? 'Desactivar' : 'Activar'} sonido">${icon(prefs.sound ? 'sound' : 'mute')}</button><button class="icon-button mobile-settings" data-action="settings" aria-label="Preferencias">${icon('settings')}</button></div></header><main id="main" tabindex="-1">${content}</main><footer class="footer"><span>Hecho para disfrutar, carta a carta.</span><button data-action="rules">Reglas de esta mesa ${icon('arrow')}</button></footer></div>
  </div>`;
}

function renderHome() {
  const saved = session.view(0);
  const canResume = saved && saved.status !== 'finished';
  app.innerHTML = shell(`<section class="welcome-heading"><div><p class="eyebrow">EL JUEGO QUE NOS REÚNE</p><h1>El Cuarenta de siempre.</h1><p class="intro">Baraja, reparte y disfruta. La próxima buena mano empieza aquí.</p></div></section>
    <section class="lobby-layout" aria-label="Preparar una partida">
      <div class="hero-table"><div class="hero-table-inner"><div class="hero-fan" aria-hidden="true">${cardMarkup(demoCard('A', 'hearts'))}${cardMarkup(demoCard('7', 'clubs'))}${cardMarkup(demoCard('K', 'diamonds'))}</div></div><div class="hero-bottom"><span>Un poquito de suerte.</span><span>Mucho de saber jugar.</span></div></div>
      <div class="setup-panel"><h2>¿Cómo jugamos?</h2><div class="mode-options" role="group" aria-label="Modo de juego"><button class="mode-option ${mode === 'solo' ? 'chosen' : ''}" data-action="mode" data-mode="solo" aria-pressed="${mode === 'solo'}"><span class="mode-icon">${icon('bot')}</span><span><strong>Contra la máquina</strong><small>Tu mano contra Don Jacinto.</small></span><span class="radio-dot"></span></button><button class="mode-option ${mode === 'pass' ? 'chosen' : ''}" data-action="mode" data-mode="pass" aria-pressed="${mode === 'pass'}"><span class="mode-icon">${icon('people')}</span><span><strong>Pasar el dispositivo</strong><small>Dos personas, una misma mesa.</small></span><span class="radio-dot"></span></button></div>
      <form id="new-game-form">${mode === 'solo' ? `<div class="difficulty-picker"><label for="bot-difficulty">Nivel de la máquina</label><select id="bot-difficulty" name="difficulty" aria-describedby="difficulty-note">${Object.entries(difficultyNames).map(([key,label]) => `<option value="${key}" ${difficulty === key ? 'selected' : ''}>${label}</option>`).join('')}</select><p class="difficulty-note" id="difficulty-note">${difficultyNotes[difficulty]}</p></div>` : ''}<div class="name-fields"><label>Tu nombre<input id="player-name" name="player" autocomplete="off" maxlength="20" placeholder="Tú" value=""></label>${mode === 'pass' ? '<label>Nombre del otro jugador<input id="opponent-name" name="opponent" autocomplete="off" maxlength="20" placeholder="Jugador 2"></label>' : ''}</div><div class="combo-choice"><span>Caída y limpia ${icon('spark')}</span><div role="group" aria-label="Puntos de caída y limpia"><button type="button" class="${comboPoints === 2 ? 'chosen' : ''}" data-action="combo" data-points="2" aria-pressed="${comboPoints === 2}">2 puntos</button><button type="button" class="${comboPoints === 4 ? 'chosen' : ''}" data-action="combo" data-points="4" aria-pressed="${comboPoints === 4}">4 puntos</button></div></div><p class="rule-callout">Ronda: +2 puntos. Caída a la ronda: partida ganada.</p><button class="button primary start-button" type="submit">Repartir cartas ${icon('arrow')}</button></form>
      ${canResume ? `<button class="button resume-button" data-action="resume">${icon('play')} Continuar partida · ${saved.players[0].score} a ${saved.players[1].score}</button>` : ''}
      ${canResume && legacyRules(saved) ? '<p class="legacy-note">Tu partida guardada conserva las reglas anteriores. Reparte una nueva para activar la caída a la ronda.</p>' : ''}<p class="setup-footnote">A 40 puntos · Sin reloj · <button data-action="rules">Ver reglas</button></p></div>
    </section><section class="home-notes" aria-label="Sobre esta edición"><div>${icon('shield')}<span><strong>Solo tú y las cartas</strong><small>Sin cuentas, anuncios ni Internet.</small></span></div><div>${icon('save')}<span><strong>A tu propio ritmo</strong><small>Tu partida se guarda en este navegador.</small></span></div><button data-action="tutorial">${icon('book')}<span><strong>¿Hace tiempo que no juegas?</strong><small>Repasa las jugadas en un momento.</small></span>${icon('arrow')}</button></section>`);
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
  return `<div class="table-layout-picker" role="group" aria-label="Orientación de la mesa">${buttons.join('')}</div>`;
}

function changeTableLayout(layout) {
  if (!Object.hasOwn(tableLayouts, layout) || prefs.tableLayout === layout) return;
  prefs.tableLayout = layout;
  app.querySelector('#main').dataset.tableLayout = layout;
  for (const button of app.querySelectorAll('.table-layout-picker button')) {
    button.setAttribute('aria-pressed', String(button.dataset.layout === layout));
  }
  if (!savePreferences(prefs)) toast('No se pudo guardar la orientación en este navegador.');
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
  let instruction = v.status === 'round-end' ? 'Terminó el ciclo. Vamos a contar el cartón.' : v.status === 'finished' ? 'La chica ya tiene ganador.' : locked ? 'Las cartas están ocultas. Pasa el dispositivo.' : !myTurn ? `${other.name} está pensando…` : selectedId ? (captureIds.length ? `Recoges ${captureIds.length + 1} cartas${chosen.points ? ` · +${chosen.points} puntos` : ''}` : 'Esta carta se quedará en la mesa.') : 'Tu turno. Elige una carta de tu mano.';
  if (chosen?.rondaFall) instruction = '¡Caída a la ronda! Esta jugada gana la partida.';
  else if (chosen?.winsGame) instruction = 'Esta jugada completa los 40 puntos.';
  app.innerHTML = shell(`<div class="game-heading"><div><p class="eyebrow">${mode === 'solo' ? 'TÚ CONTRA DON JACINTO' : 'UNA MESA PARA DOS'}</p><h1>Que hablen las cartas.</h1>${mode === 'solo' ? `<span class="difficulty-badge">Mesa ${difficultyNames[v.difficulty || 'medium'].toLowerCase()}</span>` : ''}</div><div class="game-heading-actions">${tableLayoutPicker()}<button class="button outline small-button" data-action="new">${icon('cards')} Nueva partida</button></div></div><div class="game-layout"><section class="game-column"><div class="game-table ${locked ? 'table-locked' : ''}" aria-label="Mesa de Cuarenta"><div class="table-meta"><span>CICLO ${v.round} <i>·</i> REPARTO ${v.deal}/4</span><span class="deck-label">${icon('cards')} ${v.deckCount} por repartir</span></div><div class="opponent-zone">${playerBadge(other, false, v.turn === other.id)}<div class="opponent-hand" aria-label="${other.handCount} cartas ocultas">${Array.from({ length: other.handCount }, () => cardMarkup(null, { back: true })).join('')}</div></div><div class="table-center"><span class="felt-watermark" aria-hidden="true">40</span><div class="table-cards" aria-label="Cartas sobre la mesa">${v.table.length ? v.table.map(c => cardMarkup(c, { highlight: captureIds.includes(c.id), last: v.lastPlay?.cardId === c.id })).join('') : '<div class="empty-table"><span>La mesa está limpia.</span><small>Una carta puede cambiarlo todo.</small></div>'}</div></div><div class="own-zone">${!locked && v.rondas?.[viewer] && me.hand?.some(c => v.rondas[viewer].cardIds.includes(c.id)) ? `<div class="ronda-notice">${icon('spark')} Tu ronda de ${esc(v.rondas[viewer].rank)} · +2 al repartir</div>` : ''}<div class="own-label">${playerBadge(me, true, v.turn === me.id)}<span class="hand-tip">${myTurn ? 'ELIGE TU CARTA' : 'TU MANO'}</span></div><div class="own-hand ${myTurn ? '' : 'waiting-hand'}" aria-label="${locked ? 'Mano oculta' : 'Tu mano'}">${locked ? Array.from({ length: me.handCount }, () => cardMarkup(null, { back: true })).join('') : (me.hand || []).map(c => cardMarkup(c, { interactive: myTurn, selected: c.id === selectedId })).join('')}</div></div>${locked ? `<div class="privacy-curtain"><div class="privacy-icon">${icon('eye')}</div><p class="eyebrow">CAMBIO DE TURNO</p><h2>Pasa el dispositivo a<br>${esc(v.players[v.turn].name)}.</h2><p>Tu mano solo aparece cuando estés listo.</p><button class="button gold" data-action="reveal">Soy ${esc(v.players[v.turn].name)} · Ver mi mano ${icon('arrow')}</button></div>` : ''}</div><div class="action-panel"><div class="action-copy"><span class="action-dot ${myTurn ? 'ready' : ''}"></span><div><strong>${esc(instruction)}</strong><small>${chosen ? moveDescription(chosen) : myTurn ? 'Haz clic o toca una carta. Después confirma la jugada.' : 'Sin prisa. Aquí se juega a gusto.'}</small></div></div><div class="move-controls">${moves.length > 1 ? `<button class="button outline option-button" data-action="next-capture">Opción ${selectedMoveIndex + 1} de ${moves.length}</button>` : ''}${v.status === 'round-end' ? '<button class="button primary" data-action="round-summary">Ver el conteo</button>' : v.status === 'finished' ? '<button class="button primary" data-action="result">Ver resultado</button>' : `<button class="button primary play-button" data-action="play" ${!chosen || locked ? 'disabled' : ''}>${chosen?.captureIds.length ? 'Recoger cartas' : 'Jugar carta'} ${icon('arrow')}</button>`}</div></div><div class="save-status">${icon(session.warning ? 'shield' : 'check')} ${esc(session.warning || 'Partida guardada en este navegador')}${mode === 'pass' ? '<span>Las manos se ocultan entre turnos.</span>' : ''}</div></section><aside class="game-aside" aria-label="Marcador e historial">${scorePanel(v)}<section class="history-panel"><div class="panel-label">ASÍ VA LA PARTIDA <span>Últimas jugadas</span></div><ol class="history-list">${(v.history || []).slice(-7).reverse().map((e, i) => `<li class="${i === 0 ? 'latest' : ''}"><span class="history-icon">${icon(e.points ? 'spark' : 'cards')}</span><span>${esc(e.text)}</span></li>`).join('') || '<li>La baraja está lista. ¡A jugar!</li>'}</ol></section><button class="help-tile" data-action="rules">${icon('book')}<span>¿Una duda con las reglas?<small>El reglamento de esta mesa</small></span>${icon('arrow')}</button></aside></div>`);
  app.querySelector('#main').dataset.tableLayout = prefs.tableLayout;
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
  screen === 'home' ? renderHome() : renderGame();
}

function focusGame() {
  app.querySelector('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function announce(text) { document.querySelector('#announcement').textContent = text; }
function toast(text) {
  const node = document.querySelector('#toast');
  clearTimeout(toastTimer); node.textContent = text; node.hidden = false;
  toastTimer = setTimeout(() => { node.hidden = true; }, 4500);
}

function playSound(points = 0) {
  if (!prefs.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine'; osc.frequency.value = points ? 660 : 350;
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .13);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .14);
  } catch { /* Sound never interrupts the game. */ }
}

function cancelBot() { clearTimeout(botTimer); botTimer = null; }
function scheduleBot() {
  cancelBot();
  const v = session.view(0);
  if (screen !== 'game' || modal.open || !v || v.mode !== 'solo' || v.turn !== 1 || v.status !== 'playing') return;
  const revision = v.revision;
  botTimer = setTimeout(() => {
    if (session.revision !== revision || screen !== 'game' || modal.open) return;
    try {
      const move = chooseBotMove(session.view(1), {
        feedbackChallenge: prefs.feedbackMode ? prefs.feedbackChallenge : 0,
      });
      if (!move) throw new Error('No se pudo resolver el turno de la máquina.');
      session.dispatch({ type: 'PLAY', move }); afterMove();
    } catch (error) { toast(error.message); render(); }
  }, prefs.quickBot || prefs.reducedMotion ? 280 : 1000);
}

function afterMove() {
  selectedId = null; selectedMoveIndex = 0;
  const v = session.view(0);
  if (v.mode === 'pass' && v.status === 'playing') locked = true;
  announce(v.lastEvent?.text || 'Jugada realizada.'); playSound(v.lastEvent?.points);
  render();
  if (v.status === 'round-end') showRoundSummary();
  else if (v.status === 'finished') showResult();
  else scheduleBot();
}

function startGame(options) {
  cancelBot(); closeModal(false);
  try {
    session.dispatch({ type: 'NEW_GAME', options });
    screen = 'game'; mode = options.mode; difficulty = options.difficulty || 'medium'; viewer = 0; locked = mode === 'pass'; selectedId = null;
    render(); focusGame(); announce('Partida iniciada.');
    if (session.view(0).status === 'finished') showResult(); else scheduleBot();
    if (session.warning) toast(session.warning);
  } catch (error) { toast(error.message); }
}

function readForm() {
  const clean = (id, fallback) => (document.getElementById(id)?.value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 20) || fallback;
  const names = [clean('player-name', 'Tú'), mode === 'solo' ? 'Don Jacinto' : clean('opponent-name', 'Jugador 2')];
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
  showModal('rules', `${modalHeader('Las reglas, sobre la mesa.', old ? 'PERFIL LOCAL V1 · PARTIDA ANTERIOR' : 'PERFIL LOCAL V2 · RONDA GANADORA')}<p class="modal-intro">Una chica a 40 puntos, con 40 cartas y cinco cartas por reparto. Las reglas se fijan al comenzar.</p><div class="rule-scores"><div><strong>2</strong><span>Caída</span></div><div><strong>2</strong><span>Ronda</span></div><div><strong>${points}</strong><span>Caída y limpia</span></div></div>${old ? '' : '<p class="rule-callout">Caída a la ronda = victoria inmediata, sin necesitar 40 puntos.</p>'}<div class="rules-list"><details open><summary>Ronda: tres cartas iguales</summary><p>${rondaText} El valor de tu ronda solo se muestra en tu mano.</p></details>${old ? '' : '<details open><summary>Caída a la ronda: partida ganada</summary><p>Si tu rival juega una de las tres cartas originales de su ronda y tú la capturas por igualdad en el turno inmediato siguiente, ganas. Puede ser la primera, segunda o tercera carta de esa ronda. Debe ser el mismo reparto: recogerla por suma, incluirla en una escalera o capturarla más tarde no da esta victoria.</p></details>'}<details><summary>Capturas, caída y limpia</summary><p>Iguala una carta de la mesa o suma dos o más cartas numéricas para obtener el valor de la tuya. Elige una sola base de captura y completa su escalera: A, 2, 3, 4, 5, 6, 7, J, Q, K. Si falta un valor, termina. Las figuras no se suman. Caer a la carta del turno rival anterior da 2 puntos. La limpia deja la mesa vacía y da 2; juntas valen ${points}.</p></details><details><summary>Cartón y cartas que sobran</summary><p>20 cartas recogidas dan 6 puntos. Cada carta adicional suma uno, redondeando a par. El cartón solo suma hasta 30. En empate, 2 puntos al siguiente repartidor. Si ambos tienen menos de 20 sin empatar, nadie cobra. Las sobrantes se descartan.</p></details><details><summary>El cierre desde 38</summary><p>En las jugadas, desde 38 solo puntúa una caída, no una limpia. ${old ? '' : 'Una nueva ronda también suma sus 2 puntos y cierra la partida. La caída a una ronda gana con cualquier marcador.'} Cuatro iguales al repartir ganan automáticamente; si ambos los reciben, se repite ese reparto.</p></details><details><summary>Cuatro niveles, las mismas reglas</summary><p>Fácil elige jugadas legales al azar. Medio prioriza puntos y capturas. Difícil evalúa respuestas inmediatas y cuida sus cartas de ronda. Experto compara hasta 12 jugadas priorizadas y 8 respuestas probables del rival, y calcula una contra-jugada con las cartas que conserva. La retroalimentación local puede ampliar o reducir esta búsqueda. No recibe la mano rival ni el orden del mazo. Su búsqueda es heurística y no garantiza la victoria.</p></details><details><summary>Esta edición local</summary><p>Sin reloj ni penalizaciones por esperar. Juega contra Don Jacinto o comparte el dispositivo, ocultando las manos entre turnos. El guardado pertenece a este navegador.</p></details></div><button class="button primary full-width" data-action="close-modal">Todo claro ${icon('check')}</button>`);
}

function showSettings() {
  const adjustment = prefs.feedbackChallenge > 0 ? 'más difícil' : prefs.feedbackChallenge < 0 ? 'más accesible' : 'estándar';
  showModal('settings', `${modalHeader('A tu manera.', 'PREFERENCIAS')}<p class="modal-intro">Pequeños detalles para disfrutar la partida.</p><div class="preference-list">${[['sound', 'Sonidos de la mesa', 'Un toque suave al jugar y puntuar.'], ['reducedMotion', 'Reducir movimiento', 'Una experiencia más tranquila.'], ['quickBot', 'Máquina más rápida', 'Menos espera entre jugadas.'], ['feedbackMode', 'Retroalimentación del Experto', 'Al final de cada partida Experto puedes valorar el reto.']].map(([key, title, sub]) => `<label class="preference-row"><span><strong>${title}</strong><small>${sub}</small></span><input type="checkbox" data-preference="${key}" ${prefs[key] ? 'checked' : ''}><span class="switch" aria-hidden="true"></span></label>`).join('')}</div><p class="preferences-note">Ajuste actual del reto: ${adjustment}. Se guarda en este navegador.${prefs.feedbackChallenge ? ' <button class="button text-button" data-action="reset-feedback">Restablecer ajuste</button>' : ''}</p><button class="button primary full-width" data-action="close-modal">Volver a la mesa ${icon('arrow')}</button>`);
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

const lessons = [
  { ronda: true, title: 'Tres iguales, una ronda.', text: 'Al recibir tres cartas del mismo valor sumas 2 puntos. Se cobra automáticamente en cada reparto, también desde 30 o 38.', hand: ['5', 'hearts'], table: [['5', 'clubs'], ['5', 'diamonds']], take: [0, 1], result: 'Recibiste tres cincos en tu mano: ronda, +2 puntos. Conservas las cartas para jugarlas después.' },
  { title: 'A la ronda se le cae.', text: 'Si el rival juega una carta de su ronda y le caes inmediatamente por igualdad, ganas la partida. Puede ser cualquiera de sus tres cartas originales.', hand: ['5', 'hearts'], table: [['5', 'clubs'], ['K', 'spades']], take: [0], result: 'El rival acaba de soltar un 5 de su ronda. Lo recoges con tu 5: ¡chica ganada, aunque todavía no tengas 40!' },
  { title: 'Igual con igual.', text: 'Juega una carta del mismo valor para recoger la de la mesa. Te llevas las dos.', hand: ['5', 'hearts'], table: [['5', 'clubs'], ['K', 'spades']], take: [0], result: 'Tu 5 recoge el otro 5. El rey se queda en la mesa.' },
  { title: 'Las cuentas sí importan.', text: 'Las cartas numéricas pueden recoger una suma de dos o más cartas. Las figuras no participan en sumas.', hand: ['7', 'hearts'], table: [['3', 'clubs'], ['4', 'diamonds'], ['K', 'spades']], take: [0, 1], result: '3 + 4 = 7. Te llevas las tres cartas.' },
  { title: 'Sigue la escalera.', text: 'Después de una captura, recoge un valor consecutivo a la vez. Después del 7 viene la J.', hand: ['7', 'hearts'], table: [['7', 'clubs'], ['J', 'diamonds'], ['K', 'spades']], take: [0, 1], result: 'Recoges 7 y J. El rey se queda: falta la Q.' },
  { title: '¡Dos por la caída!', text: 'Si igualas la carta que acaba de dejar tu rival, cobras 2 puntos. Debe ser la del turno anterior y del mismo reparto.', hand: ['4', 'hearts'], table: [['4', 'clubs'], ['K', 'spades']], take: [0], result: 'El rival acaba de jugar el 4. Le caes con tu 4: +2 puntos.' },
  { title: 'La mesa, limpiecita.', text: 'Una captura que no deja cartas en la mesa es limpia: 2 puntos. Caída y limpia juntas dependen de la variante elegida.', hand: ['7', 'hearts'], table: [['3', 'clubs'], ['4', 'diamonds']], take: [0, 1], result: '3 + 4 = 7. No queda ninguna carta: limpia, +2 puntos.' },
  { title: 'El cierre tiene su truco.', text: 'Al acabar las 40 cartas se cuenta el cartón, que solo puede llevarte hasta 30 puntos. Desde 38 puedes cerrar con una caída o con los 2 puntos de una nueva ronda.', hand: ['A', 'hearts'], table: [['A', 'clubs']], take: [0], result: 'Si estabas en 38 y el rival acaba de jugar el as: caída, 40 y ¡chica ganada!' },
];

function showTutorial() {
  const l = lessons[tutorialStep];
  const savedLegacy = screen === 'game' && legacyRules(getView());
  showModal('tutorial', `${modalHeader(l.title, `APRENDE JUGANDO · ${tutorialStep + 1} DE ${lessons.length}`)}<p class="modal-intro">${l.text}</p>${savedLegacy ? '<p class="legacy-note">Este tutorial explica las reglas nuevas. Tu partida anterior conserva el perfil V1: consulta «Reglas de esta mesa».</p>' : ''}${l.ronda ? `<div class="lesson-board"><span class="lesson-label">EN TU MANO AL REPARTIR</span><div class="lesson-table">${[...l.table,l.hand].map(([rank,suit]) => cardMarkup(demoCard(rank,suit),{highlight:tutorialRevealed})).join('')}</div></div>` : `<div class="lesson-board"><span class="lesson-label">EN LA MESA</span><div class="lesson-table">${l.table.map(([rank, suit], i) => `<div class="${tutorialRevealed && l.take.includes(i) ? 'lesson-taken' : ''}">${cardMarkup(demoCard(rank, suit), { highlight: tutorialRevealed && l.take.includes(i) })}</div>`).join('')}</div><span class="lesson-label">TU CARTA</span><div class="lesson-hand">${cardMarkup(demoCard(...l.hand), { selected: tutorialRevealed })}</div></div>`}<div class="lesson-explanation">${tutorialRevealed ? l.result : l.ronda ? 'Las tres cartas tienen el mismo valor: esta mano contiene una ronda.' : 'Observa la mesa y piensa qué cartas puedes recoger.'}</div><div class="lesson-navigation"><button class="button outline" data-action="lesson-prev" ${tutorialStep === 0 ? 'disabled' : ''}>${icon('back')} Atrás</button>${!tutorialRevealed ? `<button class="button primary" data-action="lesson-show">Ver la jugada ${icon('play')}</button>` : `<button class="button primary" data-action="lesson-next">${tutorialStep === lessons.length - 1 ? 'Listo para jugar' : 'Siguiente'} ${icon('arrow')}</button>`}</div>`);
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
  if (action === 'home') { cancelBot(); closeModal(false); screen = 'home'; selectedId = null; render(); }
  else if (action === 'mode') { const name = document.querySelector('#player-name')?.value || ''; mode = target.dataset.mode; render(); document.querySelector('#player-name').value = name; }
  else if (action === 'combo') { comboPoints = Number(target.dataset.points); const values = readForm(); render(); document.querySelector('#player-name').value = values.names[0] === 'Tú' ? '' : values.names[0]; if (mode === 'pass') document.querySelector('#opponent-name').value = values.names[1] === 'Jugador 2' ? '' : values.names[1]; }
  else if (action === 'resume') { screen = 'game'; viewer = 0; locked = session.view(0).mode === 'pass'; render(); focusGame(); const v = getView(); if (v.status === 'round-end') showRoundSummary(); else scheduleBot(); }
  else if (action === 'table-layout') changeTableLayout(target.dataset.layout);
  else if (action === 'reveal') { viewer = getView().turn; locked = false; render(); announce(`Turno de ${getView().players[viewer].name}.`); }
  else if (action === 'select-card') { selectedId = target.dataset.card; selectedMoveIndex = 0; render(); document.querySelector(`[data-card="${CSS.escape(selectedId)}"]`)?.focus(); }
  else if (action === 'next-capture') { selectedMoveIndex++; const moves = legalMoves(getView(), viewer).filter(m => m.cardId === selectedId); selectedMoveIndex %= moves.length; render(); }
  else if (action === 'play') {
    const v = getView(); const move = legalMoves(v, viewer).filter(m => m.cardId === selectedId)[selectedMoveIndex];
    if (!move || locked) return;
    try { session.dispatch({ type: 'PLAY', move: { ...move, playerId: viewer, expectedRevision: v.revision } }); afterMove(); }
    catch (error) { toast(error.message); selectedId = null; render(); }
  }
  else if (action === 'next-round') { closeModal(false); try { session.dispatch({ type: 'NEXT_ROUND' }); locked = mode === 'pass'; selectedId = null; render(); if (getView().status === 'finished') showResult(); else scheduleBot(); } catch (error) { toast(error.message); } }
  else if (action === 'rules') showRules();
  else if (action === 'settings') showSettings();
  else if (action === 'feedback-rating') rateBot(target.dataset.rating);
  else if (action === 'skip-feedback') { completeBotFeedback(getView()?.id); showResult(); }
  else if (action === 'reset-feedback') { prefs.feedbackChallenge = 0; savePreferences(prefs); showSettings(); }
  else if (action === 'tutorial') { tutorialStep = 0; tutorialRevealed = false; showTutorial(); }
  else if (action === 'lesson-show') { tutorialRevealed = true; showTutorial(); }
  else if (action === 'lesson-prev') { tutorialStep = Math.max(0, tutorialStep - 1); tutorialRevealed = false; showTutorial(); }
  else if (action === 'lesson-next') { if (tutorialStep === lessons.length - 1) closeModal(); else { tutorialStep++; tutorialRevealed = false; showTutorial(); } }
  else if (action === 'close-modal') closeModal();
  else if (action === 'sound') { prefs.sound = !prefs.sound; savePreferences(prefs); playSound(2); render(); }
  else if (action === 'new') showModal('new', `${modalHeader('¿Volvemos a repartir?')}<p class="modal-intro">Volverás a elegir el modo de juego. Tu partida actual seguirá guardada hasta que inicies otra.</p><button class="button primary full-width" data-action="home">Ir al inicio ${icon('arrow')}</button><button class="button text-button full-width" data-action="close-modal">Seguir esta partida</button>`);
  else if (action === 'round-summary') showRoundSummary();
  else if (action === 'result') showResult();
  else if (action === 'rematch') { const v = getView(); startGame({ mode: v.mode, names: v.players.map(p => p.name), comboPoints: v.rules.comboPoints, difficulty: v.difficulty || 'medium' }); }
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) handleAction(button);
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
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelBot(); else scheduleBot(); });
window.addEventListener('pagehide', cancelBot);
render();
if (session.warning) toast(session.warning);
