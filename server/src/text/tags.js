// Text-based feedback parsing: turn a free-text review into short tags
// like "Clear lectures" or "Tough grader", so students can skim quickly.
// Each tag has trigger phrases; a negation word right before a phrase cancels it
// ("not clear" should NOT produce "Clear lectures").

const TAGS = {
  'Clear lectures': ['clear', 'well organized', 'explains well', 'great examples', 'easy to follow'],
  'Confusing lectures': ['confusing', 'disorganized', 'hard to follow', 'unclear'],
  'Tough grader': ['tough grader', 'harsh grading', 'strict grading', 'hard grader'],
  'Fair grading': ['fair'],
  'Hard exams': ['hard exams', 'exams are hard', 'difficult exams', 'tough exams', 'very hard exams'],
  'Heavy workload': ['heavy workload', 'lots of homework', 'busywork', 'a lot of work'],
  'Easy A': ['easy a', 'easy class', 'easy grader'],
  'Helpful': ['helpful', 'office hours', 'responsive', 'answers emails'],
  'Caring': ['cares about students', 'caring', 'really cares', 'supportive'],
  'Engaging': ['engaging', 'amazing', 'inspiring', 'fun class', 'passionate'],
  'Recorded lectures': ['recordings', 'recorded'],
};

const NEGATIONS = ['not', "isn't", "wasn't", 'never', 'no', 'barely', 'hardly'];

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTags(text) {
  const lower = ` ${String(text).toLowerCase()} `;
  const found = [];
  for (const [tag, phrases] of Object.entries(TAGS)) {
    const hit = phrases.some((p) => {
      const re = new RegExp(`(\\S+\\s+)?\\b${escape(p)}\\b`, 'g');
      let m;
      while ((m = re.exec(lower)) !== null) {
        const before = (m[1] || '').trim();
        if (!NEGATIONS.includes(before)) return true;
      }
      return false;
    });
    if (hit) found.push(tag);
  }
  return found;
}

module.exports = { extractTags, TAGS };
