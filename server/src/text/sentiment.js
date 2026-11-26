// Lexicon-based sentiment for review text, in the spirit of VADER/AFINN:
// each word has a score, "very"/"extremely" amplify the next word, and a negation
// ("not", "never", "n't") within 3 words flips it ("not helpful" is negative).
// Returns a value from -1 (very negative) to +1 (very positive).

const LEXICON = {
  amazing: 3, awesome: 3, excellent: 3, fantastic: 3, best: 3, love: 3, loved: 3, brilliant: 3,
  great: 2, helpful: 2, clear: 2, engaging: 2, caring: 2, fair: 1.5, passionate: 2, inspiring: 3,
  good: 1.5, nice: 1.5, organized: 1.5, interesting: 1.5, fun: 2, easy: 1, recommend: 2,
  learned: 1.5, approachable: 2, kind: 2, patient: 2, responsive: 1.5, useful: 1.5,
  bad: -2, terrible: -3, awful: -3, worst: -3, boring: -2, confusing: -2, disorganized: -2,
  unfair: -2, rude: -3, harsh: -1.5, unclear: -1.5, hate: -3, hated: -3, avoid: -2.5, useless: -2.5,
  difficult: -0.5, hard: -0.5, tough: -0.5, busywork: -1.5, condescending: -3, late: -1,
  unhelpful: -2, monotone: -1.5, lazy: -2, waste: -2.5, ridiculous: -2, frustrating: -2,
};
const BOOSTERS = { very: 1.5, extremely: 1.8, super: 1.5, really: 1.3, so: 1.3, incredibly: 1.8,
  somewhat: 0.6, slightly: 0.5, kinda: 0.6 };
const NEGATORS = new Set(['not', 'never', 'no', "isn't", "wasn't", "aren't", "don't", "doesn't",
  "didn't", 'hardly', 'barely', 'nothing']);

function tokenize(text) {
  return String(text).toLowerCase().replace(/n't\b/g, " n't").match(/[a-z']+/g) || [];
}

function sentiment(text) {
  const words = tokenize(text);
  let total = 0;
  let hits = 0;
  words.forEach((w, i) => {
    if (!(w in LEXICON)) return;
    let s = LEXICON[w];
    const prev = words[i - 1];
    if (prev in BOOSTERS) s *= BOOSTERS[prev];
    const window = words.slice(Math.max(0, i - 3), i);
    if (window.some((x) => NEGATORS.has(x) || x === "n't")) s *= -0.75; // "not great" ≈ mildly bad
    total += s;
    hits += 1;
  });
  if (!hits) return 0;
  // Normalize like VADER: x / sqrt(x^2 + alpha) keeps the result in (-1, 1).
  return Math.round((total / Math.sqrt(total * total + 15)) * 100) / 100;
}

module.exports = { sentiment, tokenize };
