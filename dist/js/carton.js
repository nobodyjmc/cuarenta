import { cardSvg } from './cards.js';

/** Animate a projection of the completed cycle. Scoring and ownership are already settled. */
export function startCartonCount(root, view, animated, onPileStart) {
  const { piles, captured } = view.roundSummary;
  const hasCards = piles?.length === 2 && piles.every((pile, seat) =>
    Array.isArray(pile) && pile.length === captured[seat]);
  const panels = Array.from(root.querySelectorAll('.carton-player'));
  const skip = root.querySelector('[data-action="skip-carton"]');
  const next = root.querySelector('.carton-continue');
  const status = root.querySelector('.carton-status');
  let timer;
  let seat = 0;
  let count = 0;

  function display(index, total, deal) {
    const panel = panels[index];
    panel.querySelector('.carton-count-value').textContent = total;
    panel.querySelector('.carton-tally small').textContent = total === 1 ? 'carta' : 'cartas';
    const stack = panel.querySelector('.carton-stack');
    stack.dataset.stacked = String(total > 1 && hasCards);
    const card = hasCards && piles[index][total - 1];
    const previous = stack.lastElementChild;
    if (!card || previous?.dataset.card === card.id) return;
    const face = document.createElement('div');
    face.className = deal ? 'carton-face carton-dealt' : 'carton-face';
    face.dataset.card = card.id;
    face.innerHTML = cardSvg(card);
    if (previous && deal) {
      previous.className = 'carton-under';
      previous.setAttribute('aria-hidden', 'true');
      stack.replaceChildren(previous, face);
    } else {
      stack.replaceChildren(face);
    }
  }

  function cancel() {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', visibilityChanged);
  }

  function finish() {
    cancel();
    if (root.dataset.complete === 'true') return;
    const transferFocus = document.activeElement === skip;
    panels.forEach((panel, index) => {
      display(index, captured[index], false);
      panel.dataset.active = 'false';
      panel.dataset.finished = 'true';
      panel.querySelector('.carton-award').hidden = false;
    });
    root.dataset.complete = 'true';
    root.querySelector('.carton-receipt').hidden = false;
    status.textContent = 'Conteo completo';
    next.hidden = false;
    skip.hidden = true;
    if (transferFocus) next.focus({ preventScroll: true });
  }

  function step() {
    while (seat < panels.length && count === captured[seat]) {
      panels[seat].dataset.active = 'false';
      panels[seat].dataset.finished = 'true';
      seat++;
      count = 0;
    }
    if (seat === panels.length) { finish(); return; }
    if (count === 0) {
      panels[seat].dataset.active = 'true';
      status.textContent = 'Contando · ' + view.players[seat].name;
      onPileStart();
    }
    display(seat, ++count, true);
    timer = setTimeout(step, count === captured[seat] ? 580 : 265);
  }

  function visibilityChanged() {
    clearTimeout(timer);
    if (!document.hidden) timer = setTimeout(step, 250);
  }

  if (animated && hasCards && captured.some(Boolean)) {
    document.addEventListener('visibilitychange', visibilityChanged);
    visibilityChanged();
  } else {
    finish();
  }
  return { cancel, finish };
}
