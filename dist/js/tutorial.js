import { createDeck, legalMoves, applyMove, advanceRound, assertInvariant, publicView } from './engine.js';

// Fixed teaching situations use the same rules engine as real games. These are
// independent exercises: creating or answering one never touches a saved game.
const h = (rank) => `hearts-${rank}`;
const d = (rank) => `diamonds-${rank}`;
const c = (rank) => `clubs-${rank}`;
const s = (rank) => `spades-${rank}`;
const cards = (ids) => ids.map((id) => {
  const card = createDeck().find((value) => value.id === id);
  if (!card) throw new Error(`Carta desconocida en el tutorial: ${id}`);
  return card;
});
const sameIds = (left, right) => left.length === right.length && [...left].sort().every((id, index) => id === [...right].sort()[index]);

function scenario(comboPoints, { hand = [h('7'), h('Q')], opponent = [s('K')], table = [], captured = [[], []], scores = [0, 0], lastCardId, rondas = [null, null] } = {}) {
  const used = [...hand, ...opponent, ...table, ...captured[0], ...captured[1]];
  const state = {
    schemaVersion: 1, id: 'tutorial', revision: 0,
    rules: { id: `cuarenta-local-v2-combo-${comboPoints}`, comboPoints },
    mode: 'solo', difficulty: 'medium', rondas,
    players: [hand, opponent].map((ids, id) => ({ id, name: id ? 'Rival' : 'Tú', hand: cards(ids), score: scores[id], captured: cards(captured[id]) })),
    deck: createDeck().filter((card) => !used.includes(card.id)), table: cards(table), discarded: [],
    dealer: 1, turn: 0, round: 1, deal: 1, status: 'playing', winner: null,
    lastPlay: lastCardId ? { playerId: 1, cardId: lastCardId, round: 1, deal: 1, fromRonda: Boolean(rondas[1]?.cardIds.includes(lastCardId)) } : null,
    history: [], roundSummary: null, lastEvent: null,
  };
  assertInvariant(state);
  return state;
}

function apply(state, move) {
  return applyMove(state, { playerId: 0, cardId: move.cardId, captureIds: move.captureIds, expectedRevision: state.revision });
}

function outcome(state, move) {
  return {
    hand: structuredClone(state.players[0].hand), table: structuredClone(state.table),
    score: state.players[0].score, scores: state.players.map((player) => player.score),
    winner: state.winner, status: state.status, event: structuredClone(state.lastEvent),
    ...(move ? { move: structuredClone(move) } : {}),
    ...(state.roundSummary ? { roundSummary: structuredClone(state.roundSummary) } : {}),
  };
}

function exercise(state, definition, choices) {
  const legal = legalMoves(state, 0);
  const { check, ...content } = definition;
  return {
    ...content, type: 'play', hand: structuredClone(state.players[0].hand), table: structuredClone(state.table),
    scores: state.players.map((player) => player.score), lastCardId: state.lastPlay?.cardId ?? null,
    choices: choices.map((choice, index) => {
      const move = legal.find((candidate) => candidate.cardId === choice.cardId && sameIds(candidate.captureIds, choice.captureIds));
      if (choice.correct && !move) throw new Error(`La solución de ${definition.id} no es una jugada legal.`);
      const after = choice.correct ? apply(state, move) : null;
      if (after && check && !check(after, move)) throw new Error(`El motor no cumple la enseñanza de ${definition.id}.`);
      return { ...choice, id: `${definition.id}-${index + 1}`, legal: Boolean(move), ...(after ? { after: outcome(after, move) } : {}) };
    }),
  };
}

function choice(cardId, captureIds, correct, label, feedback) {
  return { cardId, captureIds, correct, label, feedback };
}

function quiz(id, title, prompt, goal, explanation, answers, { hand = [], table = [], scores = [0, 0], after, lastCardId = null } = {}) {
  return {
    id, title, prompt, goal, explanation, type: 'quiz', hand: structuredClone(hand), table: structuredClone(table), scores, lastCardId,
    choices: answers.map(([label, correct, feedback], index) => ({ id: `${id}-${index + 1}`, label, correct, feedback, ...(correct && after ? { after } : {}) })),
  };
}

// Fisher–Yates input that creates an exact teaching hand through the production
// deal path. This injection is local to tutorial examples, never a game setting.
function orderedRandom(prefix) {
  const current = createDeck().map((card) => card.id);
  const desired = [...prefix, ...current.filter((id) => !prefix.includes(id))];
  const values = [];
  for (let i = current.length - 1; i > 0; i -= 1) {
    const j = current.indexOf(desired[i]);
    values.push((j + 0.1) / (i + 1));
    [current[i], current[j]] = [current[j], current[i]];
  }
  return () => values.length ? values.shift() : 0.25;
}

function dealt(comboPoints, prefix, score = 0) {
  const state = scenario(comboPoints, { scores: [score, 0] });
  state.players.forEach((player) => { player.hand = []; player.captured = []; });
  state.deck = []; state.discarded = createDeck(); state.status = 'round-end'; state.dealer = 0;
  state.roundSummary = { captured: [0, 0], base: [0, 0], awarded: [0, 0], leftover: 40 };
  return advanceRound(state, { random: orderedRandom(prefix) });
}

function counted(comboPoints, n0, n1, score = 0) {
  const rest = createDeck().map((card) => card.id).filter((id) => ![h('K'), s('K')].includes(id));
  const captured = [rest.splice(0, n0 - 2), rest.splice(0, n1)];
  const state = scenario(comboPoints, { hand: [h('K')], opponent: [], captured, table: [s('K'), ...rest], scores: [score, 0] });
  const move = legalMoves(state, 0).find((candidate) => candidate.cardId === h('K'));
  return apply(state, move);
}

/** Deterministic lessons; all correct tactical routes and scoring examples are
 * executed against engine.js before being returned. comboPoints is 2 or 4. */
export function createTutorialLessons(comboPoints = 2) {
  if (![2, 4].includes(comboPoints)) throw new Error('El tutorial admite caída y limpia de 2 o 4 puntos.');
  const lessons = [];
  let state = scenario(comboPoints, { hand: [h('7'), h('Q'), h('3')], table: [s('7'), h('2'), h('K')] });
  lessons.push(exercise(state, {
    id: 'igualdad', title: 'Encuentra su pareja', prompt: 'Elige una carta de tu mano y la carta del mismo valor en la mesa.', goal: 'Captura el 7 de la mesa.',
    explanation: 'Dos cartas del mismo valor se capturan aunque tengan palos distintos. Recoger cartas, por sí solo, no suma puntos.',
    check: (after, move) => move.kind === 'match' && after.players[0].captured.length === 2 && move.points === 0,
  }, [
    choice(h('7'), [s('7')], true, '7 recoge 7', 'Exacto. Tu 7 y el 7 de la mesa van a tus capturas.'),
    choice(h('Q'), [], false, 'Jugar Q', 'Puedes dejar la Q, pero no recoge el 7. Busca el mismo valor.'),
    choice(h('3'), [], false, 'Jugar 3', 'El 3 no tiene pareja ni suma disponible. Prueba el 7.'),
  ]));

  state = scenario(comboPoints, { hand: [h('7'), h('4'), h('Q')], table: [h('3'), s('4'), h('K')] });
  lessons.push(exercise(state, {
    id: 'suma', title: 'Tres más cuatro', prompt: 'Busca una carta cuya cantidad coincida con la suma de dos cartas de la mesa.', goal: 'Recoge el 3 y el 4 juntos.',
    explanation: 'Un 7 puede capturar 3 + 4. El as vale 1; J, Q y K no sirven como números para sumar.', check: (_, move) => move.kind === 'sum' && move.captureIds.length === 2,
  }, [
    choice(h('7'), [h('3'), s('4')], true, '7 recoge 3 + 4', 'Bien: 3 + 4 = 7. Se van las dos cartas y tu 7.'),
    choice(h('4'), [s('4')], false, '4 recoge 4', 'Esa captura es legal, pero deja el 3. Usa una carta que sume ambas.'),
    choice(h('7'), [h('3')], false, '7 recoge solo 3', 'Tres no equivale a siete. Selecciona también el 4.'),
    choice(h('Q'), [], false, 'Jugar Q', 'Las figuras no representan cantidades para sumar. Busca el 7.'),
  ]));

  state = scenario(comboPoints, { hand: [h('6'), h('5')], table: [h('A'), h('2'), h('3'), h('Q')] });
  lessons.push(exercise(state, {
    id: 'suma-tres', title: 'Una suma de tres cartas', prompt: 'En esta variante también puedes sumar tres o más cartas numéricas.', goal: 'Recoge A, 2 y 3 con una sola carta.',
    explanation: 'A + 2 + 3 = 6. Una suma puede usar varias cartas, siempre que el total sea exactamente el valor jugado.', check: (_, move) => move.kind === 'sum' && move.captureIds.length === 3,
  }, [
    choice(h('6'), [h('A'), h('2'), h('3')], true, '6 recoge A + 2 + 3', 'Exacto: 1 + 2 + 3 = 6.'),
    choice(h('5'), [h('2'), h('3')], false, '5 recoge 2 + 3', 'Es legal, pero el objetivo incluye también el as.'),
    choice(h('6'), [h('2'), h('3')], false, '6 recoge 2 + 3', 'Dos más tres da cinco. Falta el as para llegar a seis.'),
  ]));

  state = scenario(comboPoints, { hand: [h('7'), h('Q')], table: [s('7'), h('J'), s('Q'), h('K'), h('2')] });
  lessons.push(exercise(state, {
    id: 'escalera', title: 'Sigue hasta que falte una', prompt: 'Tras capturar el 7, continúa por las cartas consecutivas disponibles.', goal: 'Recoge 7, J, Q y K.',
    explanation: 'El orden es A, 2, 3, 4, 5, 6, 7, J, Q, K. La escalera es obligatoria y se detiene cuando falta el siguiente valor.', check: (_, move) => move.captureIds.length === 4,
  }, [
    choice(h('7'), [s('7'), h('J'), s('Q'), h('K')], true, '7 recoge 7 → J → Q → K', 'Completa. El 2 queda porque la escalera no vuelve de K al inicio.'),
    choice(h('7'), [s('7')], false, '7 recoge solo 7', 'Faltan J, Q y K: debes completar la escalera disponible.'),
    choice(h('7'), [s('7'), h('J'), h('K')], false, 'Saltar de J a K', 'No puedes saltarte la Q si está en la mesa.'),
    choice(h('Q'), [s('Q'), h('K')], false, 'Q recoge Q y K', 'Es legal, pero empieza con el 7 para recoger las cuatro.'),
  ]));

  state = scenario(comboPoints, { hand: [h('4'), h('7')], table: [h('A'), h('3'), s('4'), h('K')] });
  lessons.push(exercise(state, {
    id: 'elegir-base', title: 'Elige una sola captura', prompt: 'El 4 puede igualar otro 4 o sumar A + 3. Elige una de esas dos opciones.', goal: 'Haz una captura legal con el 4.',
    explanation: 'Puedes elegir igualdad o suma, pero no juntar dos bases independientes en una sola jugada.', check: (_, move) => move.cardId === h('4') && move.captureIds.length <= 2,
  }, [
    choice(h('4'), [s('4')], true, '4 recoge 4', 'Correcto: elegiste la igualdad. El as y el 3 permanecen.'),
    choice(h('4'), [h('A'), h('3')], true, '4 recoge A + 3', 'Correcto: elegiste la suma. El otro 4 permanece.'),
    choice(h('4'), [h('A'), h('3'), s('4')], false, '4 recoge las tres', 'Eso combina igualdad y suma. Escoge solo una base.'),
    choice(h('7'), [h('3'), s('4')], false, '7 recoge 3 + 4', 'Es legal, pero en este ejercicio debes practicar la elección con el 4.'),
  ]));

  state = scenario(comboPoints, { hand: [h('Q'), h('7'), h('3')], table: [h('A'), h('2'), h('6')] });
  lessons.push(exercise(state, {
    id: 'dejar-carta', title: 'Cuando no puedes recoger', prompt: 'Busca una carta sin pareja, suma ni escalera inicial disponible.', goal: 'Deja una carta en la mesa sin capturar.',
    explanation: 'Si la carta elegida no puede recoger, se queda en la mesa. Si sí puede, debes completar una captura legal.', check: (after, move) => move.kind === 'drop' && after.table.length === 4,
  }, [
    choice(h('Q'), [], true, 'Dejar Q', 'Eso es. La Q queda disponible para futuras jugadas.'),
    choice(h('7'), [], false, 'Dejar 7 sin recoger', 'El 7 puede recoger A + 6; no puedes dejarlo sin capturar.'),
    choice(h('3'), [], false, 'Dejar 3 sin recoger', 'El 3 puede recoger A + 2. Escoge una carta sin captura disponible.'),
  ]));

  state = scenario(comboPoints, { hand: [h('7'), h('Q')], table: [s('7'), h('2'), h('K')], lastCardId: s('7') });
  lessons.push(exercise(state, {
    id: 'caida', title: 'Cáele a la última carta', prompt: 'El rival acaba de dejar el 7 de picas. Iguala esa carta inmediatamente.', goal: 'Consigue una caída de 2 puntos.',
    explanation: 'La caída exige igualar la carta exacta del turno rival anterior. Recogerla dentro de una suma o escalera no cuenta como caída.', check: (after, move) => move.fall && !move.clean && after.players[0].score === 2,
  }, [
    choice(h('7'), [s('7')], true, '7 cae sobre 7', '¡Caída! Sumas 2 y recoges ambos sietes.'),
    choice(h('Q'), [], false, 'Dejar Q', 'Es una jugada legal, pero perderías la oportunidad de caerle ahora.'),
  ]));

  state = scenario(comboPoints, { hand: [h('7'), h('Q')], table: [h('3'), h('4'), h('J')] });
  lessons.push(exercise(state, {
    id: 'limpia', title: 'Deja la mesa vacía', prompt: 'Combina una suma con su escalera para recoger todas las cartas.', goal: 'Haz una limpia de 2 puntos.',
    explanation: 'Una captura que vacía la mesa es limpia. Aquí no hay caída: comienzas con una suma.', check: (after, move) => move.clean && !move.fall && after.players[0].score === 2,
  }, [
    choice(h('7'), [h('3'), h('4'), h('J')], true, '7 recoge 3 + 4 y J', '¡Limpia! La mesa queda vacía y sumas 2 puntos.'),
    choice(h('7'), [h('3'), h('4')], false, '7 recoge 3 + 4', 'Debes continuar por la J. Esa carta completa la limpia.'),
    choice(h('Q'), [], false, 'Dejar Q', 'La Q se queda en la mesa. Busca cómo recoger las tres cartas.'),
  ]));

  state = scenario(comboPoints, { table: [s('7'), h('J')], lastCardId: s('7') });
  const comboMove = legalMoves(state, 0).find((move) => move.cardId === h('7'));
  const comboAfter = apply(state, comboMove);
  if (!comboMove.fall || !comboMove.clean || comboAfter.players[0].score !== comboPoints) throw new Error('La lección de caída y limpia no coincide con el perfil.');
  lessons.push(quiz('caida-limpia', 'Dos jugadas en una', 'El rival dejó el 7. Tu 7 recoge ese 7 y la J, y vacía la mesa. ¿Cuántos puntos sumas?', `Usa la regla elegida: caída y limpia vale ${comboPoints}.`,
    `En este tutorial la combinación vale ${comboPoints} puntos en total. Antes de cada partida puedes elegir 2 o 4.`,
    [0, 2, 4].map((points) => [`${points} puntos`, points === comboPoints, points === comboPoints ? `Exacto: caída y limpia suma ${comboPoints}.` : `En la configuración actual la combinación suma ${comboPoints} en total.`]),
    { hand: state.players[0].hand, table: state.table, lastCardId: s('7'), after: outcome(comboAfter, comboMove) }));

  const triplePrefix = [h('5'), s('5'), c('5'), h('2'), h('K'), h('A'), h('3'), h('4'), h('6'), h('Q')];
  const ronda = dealt(comboPoints, triplePrefix);
  if (ronda.players[0].score !== 2 || !ronda.rondas[0] || publicView(ronda, 1).history.some((item) => item.kind === 'ronda')) throw new Error('La lección de ronda no conserva la puntuación y privacidad.');
  lessons.push(quiz('ronda-privada', 'Tu ronda es privada', 'Acabas de recibir tres cincos. ¿Qué ocurre al repartir?', 'Reconoce los tres iguales y su bonificación.',
    'La ronda suma 2 automáticamente. Solo tú ves su aviso y sus cartas resaltadas; el marcador sigue siendo público. En este perfil también suma desde 30 o 38.', [
      ['Sumo 2 y solo yo veo el aviso de mi ronda', true, 'Correcto. No necesitas anunciarla ni mostrar tus cartas.'],
      ['Sumo 2 y se revelan mis tres cartas al rival', false, 'La bonificación se cuenta, pero la ronda y las cartas permanecen privadas.'],
      ['Sumo 6 porque tengo tres cartas iguales', false, 'La ronda completa vale 2 puntos, no 2 por carta.'],
    ], { hand: ronda.players[0].hand, after: outcome(ronda) }));

  state = scenario(comboPoints, { hand: [h('7'), h('3')], opponent: [c('7'), d('7'), s('K')], table: [s('7'), h('2'), h('K')], scores: [0, 2], lastCardId: s('7'), rondas: [null, { rank: '7', cardIds: [s('7'), c('7'), d('7')] }] });
  lessons.push(exercise(state, {
    id: 'caida-ronda', title: 'Una caída decisiva', prompt: 'El rival acaba de dejar el 7 de picas. Hazle una caída y observa el resultado.', goal: 'Iguala el último 7 del rival.',
    explanation: 'Ese 7 pertenecía a la ronda original del rival. Caer sobre cualquiera de esas tres cartas gana inmediatamente; la ronda rival se revela en el resultado.', check: (after, move) => move.rondaFall && after.status === 'finished' && after.winner === 0 && after.players[0].score === 2,
  }, [
    choice(h('7'), [s('7')], true, '7 cae sobre 7', '¡Ganaste! Era una carta de la ronda rival: esta caída termina la partida aunque no llegues a 40.'),
    choice(h('3'), [], false, 'Dejar 3', 'Es legal, pero deja pasar la oportunidad de caerle al último 7.'),
  ]));

  const carton = counted(comboPoints, 21, 17, 28);
  if (carton.roundSummary.base[0] !== 8 || carton.roundSummary.awarded[0] !== 2 || carton.players[0].score !== 30) throw new Error('La lección de cartón no coincide con el conteo real.');
  lessons.push(quiz('carton', 'Cuenta el cartón', 'Terminas el ciclo con 21 cartas capturadas y 28 puntos. El rival tiene 17 cartas. ¿En cuánto queda tu marcador?', 'Aplica el cartón y su tope de 30.',
    'Veinte cartas dan base 6. Con 21, la base 7 se redondea a 8. Desde 28 solo cobras 2 por el tope de 30. Si nadie llega a 20 y no hay empate, nadie cobra. Las cartas sobrantes se descartan.', [
      ['30 puntos: cobro solo 2', true, 'Exacto. El tope limita una base de 8 a una bonificación efectiva de 2.'],
      ['36 puntos: cobro los 8', false, 'El cartón tiene un tope de 30; no puedes cobrar los 8 completos desde 28.'],
      ['28 puntos: 21 cartas no alcanzan', false, 'Desde 20 cartas ya hay base de cartón si superas al rival.'],
    ], { scores: [28, 0], after: outcome(carton) }));

  const tie = counted(comboPoints, 20, 20);
  if (tie.roundSummary.base[0] !== 2 || tie.roundSummary.base[1] !== 0) throw new Error('El desempate de cartón cambió.');
  lessons.push(quiz('empate-carton', 'Dos por dar', 'Ambos capturaron 20 cartas y tú repartirás el siguiente ciclo. ¿Quién recibe la base de cartón?', 'Resuelve un empate en cartas.',
    'Si ambos tienen 20, o empatan por debajo de 20, la base es 2 para quien dará el siguiente ciclo. El límite de 30 sigue aplicándose.', [
      ['Yo recibo una base de 2', true, 'Correcto: dos por dar. No son 6 para cada jugador.'],
      ['Cada jugador recibe 6', false, 'El empate tiene una regla especial: solo 2 para quien reparte después.'],
      ['Nadie puede cobrar en un empate', false, 'La base de 2 corresponde al siguiente repartidor.'],
    ]));

  state = scenario(comboPoints, { table: [h('3'), h('4')], scores: [38, 20] });
  const cleanMove = legalMoves(state, 0).find((move) => move.cardId === h('7'));
  const cleanAfter = apply(state, cleanMove);
  if (cleanAfter.players[0].score !== 38 || cleanAfter.status === 'finished') throw new Error('La lección de limpia desde 38 cambió.');
  lessons.push(quiz('treinta-ocho', 'La limpia desde 38', 'Tienes 38 puntos. Tu 7 recoge 3 + 4 y deja la mesa vacía, sin caída. ¿Qué ocurre?', 'Distingue recoger cartas de cerrar la partida.',
    'Desde 38, la limpia no suma. Una caída permite cerrar. En este perfil, una ronda recién repartida también puede llevarte de 38 a 40.', [
      ['Sigo en 38 y guardo las cartas capturadas', true, 'Así es: la limpia recoge las cartas, pero no añade puntos desde 38.'],
      ['Llego a 40 y gano por limpia', false, 'Esta limpia no suma desde 38; necesitas una caída o la excepción de ronda al repartir.'],
      ['La captura está prohibida', false, 'Puedes capturar normalmente. Lo que cambia es la puntuación.'],
    ], { hand: state.players[0].hand, table: state.table, scores: [38, 20], after: outcome(cleanAfter, cleanMove) }));

  const rondaWin = dealt(comboPoints, triplePrefix, 38);
  if (rondaWin.status !== 'finished' || rondaWin.players[0].score !== 40 || rondaWin.lastEvent.kind !== 'ronda-victory') throw new Error('La excepción de ronda desde 38 cambió.');
  lessons.push(quiz('ronda-cierre', 'La excepción al repartir', 'Llegaste al reparto con 38 puntos y recibes tres cincos. ¿Cuál es el resultado en este juego?', 'Aplica la ronda de 2 incluso desde 38.',
    'En estas reglas, la ronda suma desde 38 y ganas antes de jugar. Si ambos llegan a 40 por ronda en el mismo reparto, gana quien empieza el turno.', [
      ['Sumo 2 y gano con 40', true, 'Correcto. La ronda resuelve la victoria al repartir.'],
      ['La ronda no suma porque ya tengo 38', false, 'En este perfil la ronda sí suma desde 38. Es una excepción distinta de la limpia.'],
      ['Debo jugar las tres cartas antes de cobrar', false, 'La ronda se detecta al recibir la mano; no tienes que jugar sus cartas.'],
    ], { hand: rondaWin.players[0].hand, scores: [38, 0], after: outcome(rondaWin) }));

  const four = dealt(comboPoints, [h('7'), d('7'), c('7'), s('7'), h('K')]);
  if (four.status !== 'finished' || four.winner !== 0 || four.lastEvent.kind !== 'four-kind') throw new Error('La victoria de cuatro iguales cambió.');
  lessons.push(quiz('cuatro-iguales', 'Cuatro iguales', 'Recibes los cuatro sietes en la misma mano. ¿Qué sucede?', 'Reconoce la victoria automática.',
    'Cuatro cartas iguales al repartir ganan la chica inmediatamente. Si ambos jugadores reciben cuatro iguales simultáneamente, se repite el reparto sin cambiar puntos.', [
      ['Gano inmediatamente', true, '¡Exacto! No necesitas llegar a 40 ni jugar esas cartas.'],
      ['Solo gano los 2 puntos de ronda', false, 'Cuatro iguales se comprueba antes que una ronda y concede victoria directa.'],
      ['No ocurre nada hasta hacer una caída', false, 'La mano de cuatro iguales ya resuelve la victoria al repartir.'],
    ], { hand: four.players[0].hand, after: outcome(four) }));

  state = scenario(comboPoints, { hand: [h('6'), h('7'), h('K')], table: [h('A'), h('2'), h('3'), s('6'), h('J'), h('Q')], scores: [38, 24], lastCardId: s('6') });
  lessons.push(exercise(state, {
    id: 'desafio-final', title: 'Gana la última jugada', prompt: 'Tienes 38. El rival acaba de dejar el 6 de picas. Hay varias capturas posibles: encuentra la que te hace ganar.', goal: 'Elige la carta y la captura exactas para llegar a 40.',
    explanation: 'Tu 6 debe igualar el último 6 rival. Sumar A + 2 + 3 también sería legal, pero no es caída. Recoger el 6 dentro de A + 6 tampoco lo es.', check: (after, move) => move.fall && !move.rondaFall && after.status === 'finished' && after.players[0].score === 40,
  }, [
    choice(h('6'), [s('6')], true, '6 cae sobre el último 6', '¡Ganaste con 40! Elegiste la igualdad que produce caída.'),
    choice(h('6'), [h('A'), h('2'), h('3')], false, '6 recoge A + 2 + 3', 'La suma es legal, pero no iguala la última carta y no produce caída.'),
    choice(h('7'), [h('A'), s('6'), h('J'), h('Q')], false, '7 recoge A + 6 y sigue J → Q', 'Recoges más cartas, pero el último 6 es un sumando. No hay caída ni victoria.'),
    choice(h('K'), [], false, 'Dejar K', 'Es legal, pero la oportunidad de ganar está en igualar el último 6.'),
  ]));
  validateTutorialLessons(lessons);
  return lessons;
}

export function validateTutorialLessons(lessons) {
  if (!Array.isArray(lessons) || !lessons.length || new Set(lessons.map((lesson) => lesson.id)).size !== lessons.length) throw new Error('Lecciones vacías o repetidas.');
  for (const lesson of lessons) {
    if (!['play', 'quiz'].includes(lesson.type) || !lesson.title || !lesson.prompt || !lesson.goal || !lesson.explanation) throw new Error(`Lección incompleta: ${lesson.id}`);
    if (!Array.isArray(lesson.hand) || !Array.isArray(lesson.table) || !Array.isArray(lesson.choices) || lesson.choices.length < 2 || !lesson.choices.some((value) => value.correct) || !lesson.choices.some((value) => !value.correct)) throw new Error(`Opciones incompletas: ${lesson.id}`);
    if (new Set(lesson.choices.map((value) => value.id)).size !== lesson.choices.length) throw new Error(`Opciones repetidas: ${lesson.id}`);
    for (const value of lesson.choices) {
      if (typeof value.correct !== 'boolean' || !value.label || !value.feedback) throw new Error(`Respuesta incompleta: ${lesson.id}`);
      if (lesson.type === 'play' && (!lesson.hand.some((card) => card.id === value.cardId) || !Array.isArray(value.captureIds) || value.captureIds.some((id) => !lesson.table.some((card) => card.id === id)) || new Set(value.captureIds).size !== value.captureIds.length)) throw new Error(`Selección inválida: ${lesson.id}`);
      if (lesson.type === 'play' && value.correct && (!value.after?.move || !value.legal)) throw new Error(`Solución sin comprobar: ${lesson.id}`);
    }
  }
  return true;
}
