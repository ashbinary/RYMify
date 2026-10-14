// numerical stuffs

function starsToScore(stars) {
  return Math.round(stars * 20);
}

function scoreToStars(score) {
  return score / 20;
}

function starStates(value) {
  let v = Number(value);
  if (!Number.isFinite(v)) v = 0;
  v = Math.round(Math.max(0, Math.min(5, v)) * 2) / 2;
  return [1, 2, 3, 4, 5].map(n => n <= v ? 'full' : n - 0.5 === v ? 'half' : 'empty');
}

function scoreLabel(score) {
  return Number.isFinite(score) && score % 10 !== 0 ? `(${score})` : '';
}

// stars

function createStarWidget(score, onPick) {
  const widget = document.createElement('div');
  widget.className = 'stars';

  for (let i = 0; i < 5; i++) {
    const star = document.createElement('span');
    star.className = onPick ? 'star' : 'star-read-only';
    star.textContent = '★';
    widget.appendChild(star);
  }
  const label = document.createElement('span');
  label.className = 'rymify-score';
  widget.appendChild(label);

  setScore(widget, score);
  if (onPick) attachStarEventListeners(widget, score, onPick);

  return widget;
}

function setScore(widget, score) {
  renderStars(scoreToStars(score), widget);
  widget.querySelector('.rymify-score').textContent = scoreLabel(score);
}

function renderStars(stars, widget) {
  const states = starStates(stars);
  widget.querySelectorAll('.star, .star-read-only').forEach((star, i) => {
    star.classList.remove('full', 'half', 'empty');
    star.classList.add(states[i]);
  });
}

function starsFromEvent(e, widget) {
  const star = e.target.closest('.star');
  if (!star) return null;
  const idx = Array.from(widget.querySelectorAll('.star')).indexOf(star) + 1;
  const rect = star.getBoundingClientRect();
  return (e.clientX - rect.left) < rect.width / 2 ? idx - 0.5 : idx;
}

function attachStarEventListeners(widget, score, onPick) {
  widget.addEventListener('click', (e) => {
    const stars = starsFromEvent(e, widget);
    if (stars === null) return;
    score = starsToScore(stars);
    setScore(widget, score);
    widget.classList.add('rymify-pending');
    onPick(score);
  });

  widget.addEventListener('mousemove', (e) => {
    renderStars(starsFromEvent(e, widget) ?? scoreToStars(score), widget);
  });

  widget.addEventListener('mouseleave', () => {
    renderStars(scoreToStars(score), widget);
  });
}

async function post(url, data) {
  const res = await fetch(url, { method: 'POST', body: new URLSearchParams(data) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// ALBUM RATING

function submitRating(score) {
  const input = document.querySelector('.ratingTextBox');
  if (!input) {
    insertRating(score);
    return;
  }
  input.value = score;
  document.querySelector('.insertRating, .updateRating')?.click();
}

async function insertRating(score) {
  const current = document.querySelector('#currentRatingBlock');
  try {
    const albumID = location.pathname.match(/\/album\/(\d+)/)[1];
    const html = await post('/scripts/insertRatingLarge.php', { albumID, value: score });
    const saved = new DOMParser().parseFromString(html, 'text/html').querySelector('.yourOwn');
    current.innerHTML = saved.innerHTML;
    current.style.display = '';
  } catch (err) {
    console.warn('[RYMify] Could not submit rating:', err);
    document.querySelector('.stars.rymify-pending')?.classList.remove('rymify-pending');
  }
}

function syncOwnRating() {
  const block = document.querySelector('#ratingBlock');
  const current = document.querySelector('#currentRatingBlock');

  const form = block?.querySelector('.ratingTextBox') && (block.style.display !== 'none' || !current) ? block : null;
  const saved = [current, block?.querySelector('.yourOwn')].find(el => el && el.style.display !== 'none');
  const showForm = form || (!saved && current?.style.display === 'none');

  const activeWidget = document.querySelector('.stars.rymify-active');
  const ownWidget = document.querySelector('.stars.rymify-own');

  if (showForm) {
    ownWidget?.remove();
    form?.classList.add('rymify-hide');
    if (!activeWidget) {
      const anchor = form ?? current;
      const widget = createStarWidget(parseInt(form?.querySelector('.ratingTextBox').value, 10), submitRating);
      widget.classList.add('rymify-active');
      anchor.after(widget);
    }
    return;
  }

  activeWidget?.remove();
  block?.classList.remove('rymify-hide');
  const score = parseInt(saved?.querySelector('.rating')?.textContent, 10);
  if (!Number.isFinite(score)) {
    ownWidget?.remove();
    return;
  }

  saved.classList.add('rymify-hide');
  if (ownWidget?.previousElementSibling === saved) {
    setScore(ownWidget, score);
  } else {
    ownWidget?.remove();
    const widget = createStarWidget(score);
    widget.classList.add('rymify-own');
    saved.after(widget);
  }
}

// TRACK RATINGS

function trackState(input) {
  return {
    score: input.dataset.rymifyScore ?? input.value,
    prevScore: input.dataset.rymifyPrev ?? input.dataset.prevValue ?? '',
    ratingID: input.dataset.rymifyRatingId ?? input.dataset.ratingId ?? '',
  };
}

async function saveTrack(input, value) {
  const { prevScore, ratingID } = trackState(input);
  try {
    await post('/scripts/insertSongRating.php', { songID: input.dataset.songId, value, prevScore, ratingID });

    const btn = document.querySelector('.rateTracks');
    const panel = await post('/scripts/rateTracks.php', { albumID: btn.dataset.albumId, songID: btn.dataset.songId ?? '' });
    const fresh = new DOMParser().parseFromString(panel, 'text/html').getElementById(input.id);
    input.dataset.rymifyScore = fresh.value;
    input.dataset.rymifyPrev = fresh.dataset.prevValue ?? '';
    input.dataset.rymifyRatingId = fresh.dataset.ratingId ?? '';

    const msg = document.getElementById(`track_${input.dataset.songId}_msg`);
    msg.textContent = 'Updated';
    msg.style.cssText = 'color: green; display: block;';
  } catch (err) {
    console.warn('[RYMify] Could not save track rating:', err);
  }
  input.parentNode.querySelectorAll('.stars, .rymify-clear').forEach(el => el.remove());
  syncTrackRatings();
}

function syncTrackRatings() {
  document.querySelector('#rateTracklist')?.parentNode.querySelector('.insertTrackRatings')?.classList.add('rymify-hide');

  document.querySelectorAll('#rateTracklist .trackRating input').forEach(input => {
    if (input.parentNode.querySelector('.stars')) return;

    const { score, ratingID } = trackState(input);
    input.classList.add('rymify-hide');
    const stars = createStarWidget(parseInt(score, 10), s => saveTrack(input, s));
    input.after(stars);

    const clear = document.createElement('button');
    clear.className = ratingID ? 'rymify-clear' : 'rymify-clear rymify-invisible';
    clear.title = 'Remove rating';
    clear.textContent = '×';
    clear.addEventListener('click', () => {
      stars.classList.add('rymify-pending');
      clear.disabled = true;
      saveTrack(input, '');
    });
    stars.after(clear);
  });
}

// NON-USER RATINGS 

function replaceRating(block) {
  if (block.classList.contains('rymify-hide') || block.style.display === 'none') return; // processed/hidden 

  const ratingText = block.parentElement?.querySelector('.ratingText')?.textContent.toLowerCase() ?? '';
  if (ratingText.includes('critic') || ratingText.includes('user')) return;

  const score = parseInt(block.querySelector('.rating')?.textContent, 10);
  if (!Number.isFinite(score)) return;

  block.classList.add('rymify-hide');
  block.after(createStarWidget(score));
}

function replaceRatingDistribution() {
  document.querySelectorAll('#ratingDistribution .distLabel').forEach(label => {
    if (label.textContent.includes('★')) return; // already converted
    const score = parseInt(label.textContent, 10);
    if (!Number.isFinite(score)) return;
    label.textContent = scoreToStars(score).toFixed(1) + '★';
  });
}

// INIT 

function setupLayout() {
  document.querySelectorAll('.ratingBlock').forEach(block => {
    if (block.id !== 'currentRatingBlock' && !block.closest('#ratingBlock')) replaceRating(block);
  });
  syncOwnRating();
  syncTrackRatings();
  replaceRatingDistribution();
}

if (typeof document !== 'undefined') {
  setupLayout();
  new MutationObserver(setupLayout).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style'],
  });
}

if (typeof module !== 'undefined') module.exports = { starStates, starsToScore, scoreToStars, scoreLabel };
