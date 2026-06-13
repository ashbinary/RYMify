
let observer = null;
let currentRating = 0;

function starsToScore(stars) {
  return Math.round(stars * 20);
}

function scoreToStars(score) {
  return score / 20;
}

function findRatingControl() {
  // Look for AOTY's actual rating block
  let container = document.querySelector('#ratingBlock');
  return container;
}

function findCurrentRatingControl() {
  // Look for AOTY's actual rating block
  let container = document.querySelector('#currentRatingBlock');
  return container;
}

function findRatingInput() {
  // Look for AOTY's actual rating value div
  let input = document.querySelector('.ratingTextBox');
  return input;
}

function findCurrentRating() {
  // Look for AOTY's actual rating value div
  let input = document.querySelector('.rating');
  return input;
}

function readCurrentRating() {
  const input = findCurrentRating();
  if (!input) { return 0; }
  const score = parseInt(input.textContent, 10);
  return scoreToStars(score);
}

function createStarWidget(initialStars) {
  const widget = document.createElement('div');
  widget.className = 'stars';
  widget.setAttribute('stars', 'true');
  
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.textContent = '★';
    widget.appendChild(star);
  }
  
  renderStars(initialStars, widget);
  attachStarEventListeners(widget);
  
  return widget;
}

function createStarWidgetReadOnly(initialStars) {
  const widget = document.createElement('div');
  widget.className = 'stars';
  widget.setAttribute('stars', 'true');
  
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.className = 'star-read-only';
    star.textContent = '★';
    widget.appendChild(star);
  }
  
  renderStars(initialStars, widget);
  
  return widget;
}

// Render stars with full, half, and empty states
function renderStars(value, container) {
  const stars = container.querySelectorAll('.star, .star-read-only');
  const fullStars = Math.floor(value);
  const hasHalf = value % 1 !== 0;
  
  stars.forEach((star, index) => {
    const starNum = index + 1;
    star.classList.remove('full', 'half', 'empty');
    
    if (starNum <= fullStars) {
      star.classList.add('full');
    } else if (starNum === fullStars + 1 && hasHalf) {
      star.classList.add('half');
    } else {
      star.classList.add('empty');
    }
  });

}

// Attach event listeners to star widget
// TBD: Make this function... readable? It's a bit of a mess right now
function attachStarEventListeners(widget) {
  widget.addEventListener('click', (e) => {
    const star = e.target.closest('.star');
    if (!star) return;
    
    const stars = widget.querySelectorAll('.star');
    const starIndex = Array.from(stars).indexOf(star) + 1;
    const rect = star.getBoundingClientRect();
    const isLeft = (e.clientX - rect.left) < rect.width / 2;
    
    currentRating = isLeft ? starIndex - 0.5 : starIndex;
    renderStars(currentRating, widget);
    submitRating(currentRating);
  });
  
  widget.addEventListener('mousemove', (e) => {
    const star = e.target.closest('.star');
    if (!star) {
      renderStars(currentRating, widget);
      return;
    }
    
    const stars = widget.querySelectorAll('.star');
    const starIndex = Array.from(stars).indexOf(star) + 1;
    const rect = star.getBoundingClientRect();
    const isLeft = (e.clientX - rect.left) < rect.width / 2;
    const hoverRating = isLeft ? starIndex - 0.5 : starIndex;
    
    renderStars(hoverRating, widget);
  });
  
  widget.addEventListener('mouseleave', () => {
    renderStars(currentRating, widget);
  });
}

function submitRating(stars) {
  const input = findRatingInput();

  const score = starsToScore(stars);
  input.value = score;
  
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Trigger click on the Rate button to submit
  const rateButton = document.querySelector('.insertRating, .updateRating');

  rateButton?.click();
  
  console.log('[RYMify] Submitted rating of ', stars, 'stars (', score, 'score)');
}


function replaceActiveRating(control) {
  if (!control || control.style.display == 'none')
  {
    return;
  }
  
  // Check if already modified
  if (control.hasAttribute('stars')) {
    console.log('[AOTY Stars] Already modified, skipping injection');
    return;
  }
  
  // Hide original UI
  control.style.display = 'none';
  control.setAttribute('stars', 'true');
  
  // Create and insert star widget
  const starWidget = createStarWidget(0);
  control.parentNode.insertBefore(starWidget, control.nextSibling);
}

function replaceRating(block)
{
  const rating = block.querySelector('.rating');

  if (!rating) { // rating block doesn't contain a rating
    console.log('No .rating found in:', block);
    return;
  }

  const row = block.parentElement;
  const text = row.querySelector('.ratingText');

  if (text && 
      (text.textContent.toLowerCase().includes('critic') || 
      text.textContent.toLowerCase().includes('user'))) // returns on critic/user score blocks
  {
    return;
  }

  const score = parseInt(rating.textContent, 10);

  block.style.display = 'none';
  const starWidget = createStarWidgetReadOnly(scoreToStars(score));
  block.parentNode.insertBefore(starWidget, block.nextSibling);
}

function replaceRatingBlock()
{
  document.querySelectorAll('.ratingBlock').forEach(block => {
    replaceRating(block);
  });
}

function replaceRatingDistribution()
{
  const labels = document.querySelectorAll('#ratingDistribution .distLabel');
  if (!labels.length) { return; }
  labels.forEach(label => {
    const value = label.textContent.trim().split(' ', 1)[0];
    label.textContent = scoreToStars(parseInt(value, 10)).toFixed(1) + "★";
  });
}

function setupLayout() {
  replaceRatingBlock(); // Replaces all already-rated blocks with stars
  replaceActiveRating(findRatingControl()); // Replaces the unrated area with stars
  replaceRatingDistribution(); // Replaces the rating distribution labels with stars
}

// The MutationObserver will watch for changes in the DOM to re-inject the star UI
// Kept but not used because AOTY's page is pretty static and doesn't seem to load new content dynamically, but may be useful in the future 
function setupMutationObserver() {
  if (observer) { return; }

  observer = new MutationObserver(() => {
    document.querySelectorAll('.ratingBlock.yourOwn').forEach(el => {
      el.remove();
    });
    document.querySelectorAll('#ratingBlock #updateValue').forEach(el => {
      replaceActiveRating(el.parentElement);
    });
    // document.querySelectorAll('#ratingBlock .insertRating').forEach(el => {
    //   const stars = document.querySelector('.stars[stars="true"]');
    //   stars?.querySelectorAll('.star').forEach(star => {
    //     star.className = 'star empty';
    //   });
    //   replaceActiveRating(el.parentElement);
    // });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });  
  console.log('[RYMify] MutationObserver started');
}

function addListeners() { 
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.deleteRatingYes');
    if (!btn) return;

    const stars = document.querySelector('.stars[stars="true"]');
    stars?.querySelectorAll('.star').forEach(star => {
      star.className = 'star empty';
    });

    const button = document.querySelector('#ratingBlock .insertRating');
    if (button) { replaceActiveRating(button); }
  }, true);
}


function init() {
  console.log('[RYMify] Initializing extension...');
  setupLayout();
  setupMutationObserver();
  addListeners();
}

// Makes sure function runs no matter when in the loading process
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
