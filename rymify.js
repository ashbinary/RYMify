let observer = null;
let currentRating = 0;

// --- Conversion ---

function starsToScore(stars) {
  return Math.round(stars * 20);
}

function scoreToStars(score) {
  return score / 20;
}

// --- Star widget ---

function createStarWidget(initialStars, readOnly = false) {
  const widget = document.createElement('div');
  widget.className = 'stars';
  widget.setAttribute('stars', 'true');

  for (let i = 0; i < 5; i++) {
    const star = document.createElement('span');
    star.className = readOnly ? 'star-read-only' : 'star';
    star.textContent = '★';
    widget.appendChild(star);
  }

  renderStars(initialStars, widget);
  if (!readOnly) attachStarEventListeners(widget);

  return widget;
}

function renderStars(value, widget) {
  // Guard against NaN / out-of-range so a bad parse never blanks the widget
  let v = Number(value);
  if (!Number.isFinite(v)) v = 0;
  v = Math.max(0, Math.min(5, v));

  const stars = widget.querySelectorAll('.star, .star-read-only');
  const full = Math.floor(v);
  const hasHalf = v % 1 !== 0;

  stars.forEach((star, i) => {
    const n = i + 1;
    star.classList.remove('full', 'half', 'empty');
    if (n <= full) star.classList.add('full');
    else if (n === full + 1 && hasHalf) star.classList.add('half');
    else star.classList.add('empty');
  });
}

function ratingFromEvent(e, widget) {
  const star = e.target.closest('.star');
  if (!star) return null;
  const idx = Array.from(widget.querySelectorAll('.star')).indexOf(star) + 1;
  const rect = star.getBoundingClientRect();
  return (e.clientX - rect.left) < rect.width / 2 ? idx - 0.5 : idx;
}

function attachStarEventListeners(widget) {
  widget.addEventListener('click', (e) => {
    const rating = ratingFromEvent(e, widget);
    if (rating === null) return;
    currentRating = rating;
    renderStars(currentRating, widget);
    submitRating(currentRating);
  });

  widget.addEventListener('mousemove', (e) => {
    const rating = ratingFromEvent(e, widget);
    renderStars(rating ?? currentRating, widget);
  });

  widget.addEventListener('mouseleave', () => {
    renderStars(currentRating, widget);
  });
}

// --- Rating submission ---

function submitRating(stars) {
  const input = document.querySelector('.ratingTextBox');
  if (!input) {
    console.warn('[RYMify] Rating input not found; cannot submit');
    return;
  }

  const score = starsToScore(stars);
  input.value = score;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('.insertRating, .updateRating')?.click();
  console.log('[RYMify] Submitted rating:', stars, 'stars (score:', score + ')');
}

// --- DOM injection ---

// Read-only stars for any other rating block (e.g. other users' review ratings).
function replaceRating(block) {
  if (block.style.display === 'none') return; // already processed

  const ratingEl = block.querySelector('.rating');
  if (!ratingEl) return;

  const ratingText = block.parentElement?.querySelector('.ratingText')?.textContent.toLowerCase() ?? '';
  if (ratingText.includes('critic') || ratingText.includes('user')) return;

  const score = parseInt(ratingEl.textContent, 10);
  if (!Number.isFinite(score)) return; // don't inject a broken widget

  block.style.display = 'none';
  block.parentNode.insertBefore(createStarWidget(scoreToStars(score), true), block.nextSibling);
}

function replaceRatingDistribution() {
  document.querySelectorAll('#ratingDistribution .distLabel').forEach(label => {
    const value = parseInt(label.textContent.trim(), 10);
    if (!Number.isFinite(value)) return;
    label.textContent = scoreToStars(value).toFixed(1) + '★';
  });
}

function syncOwnRating() {
  const block = document.querySelector('#ratingBlock');
  const current = document.querySelector('#currentRatingBlock');
  
  const showForm = block && (block.style.display !== 'none' || !current);
  const showSaved = current && current.style.display !== 'none';

  const activeWidget = document.querySelector('.stars.rymify-active');
  const ownWidget = document.querySelector('.stars.rymify-own');

  if (showForm) {
    ownWidget?.remove();
    if (!activeWidget) {
      const input = block.querySelector('.ratingTextBox');
      const score = input ? parseInt(input.value, 10) : NaN;
      currentRating = Number.isFinite(score) ? scoreToStars(score) : 0;

      block.classList.add('rymify-hide');
      const widget = createStarWidget(currentRating);
      widget.classList.add('rymify-active');
      block.parentNode.insertBefore(widget, block.nextSibling);
    }
    return;
  }

  activeWidget?.remove();
  if (!showSaved) return;

  const score = parseInt(current.querySelector('.rating')?.textContent ?? '', 10);
  if (!Number.isFinite(score)) return;

  if (ownWidget) {
    renderStars(scoreToStars(score), ownWidget);
  } else {
    current.classList.add('rymify-hide');
    const widget = createStarWidget(scoreToStars(score), true);
    widget.classList.add('rymify-own');
    current.parentNode.insertBefore(widget, current.nextSibling);
  }
}

function setupLayout() {
  document.querySelectorAll('.ratingBlock').forEach(block => {
    if (block.id !== 'currentRatingBlock') replaceRating(block); // own block handled by syncOwnRating
  });
  syncOwnRating();
  replaceRatingDistribution();
}

// --- Event handling and observation ---

// AOTY rebuilds the rating markup on rate / edit / save / delete
function setupMutationObserver() {
  if (observer) return;
  observer = new MutationObserver(syncOwnRating);
  observer.observe(document.body, { childList: true, subtree: true });
  console.log('[RYMify] MutationObserver started');
}

// --- Init ---

function init() {
  console.log('[RYMify] Initializing...');
  setupLayout();
  setupMutationObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
