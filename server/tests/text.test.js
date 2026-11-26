const { extractTags } = require('../src/text/tags');
const { sentiment } = require('../src/text/sentiment');
const { moderate } = require('../src/text/moderation');
const { recommend } = require('../src/ranking');
const { normalizeCourseCode } = require('../src/courses');

describe('tags', () => {
  test('finds multiple tags', () => {
    expect(extractTags('Tough grader but lectures are clear and she is helpful.'))
      .toEqual(expect.arrayContaining(['Tough grader', 'Clear lectures', 'Helpful']));
  });
  test('negation cancels a tag', () => {
    expect(extractTags('Lectures were not clear at all.')).not.toContain('Clear lectures');
  });
  test('unclear is not mistaken for clear', () => {
    const tags = extractTags('Grading is unclear.');
    expect(tags).toContain('Confusing lectures');
    expect(tags).not.toContain('Clear lectures');
  });
});

describe('sentiment', () => {
  test('positive, negative, neutral', () => {
    expect(sentiment('Amazing professor, super helpful and clear.')).toBeGreaterThan(0.6);
    expect(sentiment('Terrible, rude, and disorganized.')).toBeLessThan(-0.6);
    expect(sentiment('I took this class in the spring.')).toBe(0);
  });
  test('negation flips polarity', () => {
    expect(sentiment('not helpful')).toBeLessThan(0);
    expect(sentiment("wasn't bad")).toBeGreaterThan(0);
  });
  test('boosters amplify', () => {
    expect(sentiment('very good')).toBeGreaterThan(sentiment('good'));
  });
});

describe('moderation', () => {
  test('clean review passes', () => {
    expect(moderate('Clear lectures and fair exams.').ok).toBe(true);
  });
  test.each(['He is an idiot', 'total sh1t class', 'f.u.c.k this class', 'so stuuuupid'])(
    'blocks disguised profanity: %s', (t) => {
      expect(moderate(t).reasons).toContain('offensive language');
    });
  test('blocks personal info', () => {
    expect(moderate('Email her at jane.doe@sjsu.edu').reasons).toContain('personal contact information');
    expect(moderate('call 408-555-1234 lol').reasons).toContain('personal contact information');
  });
  test('blocks shouting but allows acronyms', () => {
    expect(moderate('THIS CLASS IS THE WORST EVER DO NOT TAKE IT').ok).toBe(false);
    expect(moderate('Great intro to SQL and HTML for CS majors.').ok).toBe(true);
  });
  test('words that merely contain a bad word are fine', () => {
    expect(moderate('Assessment was fair; the class was in Scunthorpe hall.').ok).toBe(true);
  });
});

describe('recommendations', () => {
  const profs = [
    { name: 'Easy', bayes_rating: 4, take_again_pct: 80, avg_difficulty: 1.5, review_count: 10 },
    { name: 'Hard', bayes_rating: 4.3, take_again_pct: 80, avg_difficulty: 4.6, review_count: 10 },
  ];
  test('preference changes the order', () => {
    expect(recommend(profs, 'easy')[0].name).toBe('Easy');
    expect(recommend(profs, 'challenging')[0].name).toBe('Hard');
  });
  test('explains its reasoning', () => {
    expect(Object.keys(recommend(profs, 'easy')[0].why)).toEqual(['quality', 'retake', 'ease']);
  });
});

test('course code normalization', () => {
  expect(['cs146', 'CS-146', ' cs 146 ', 'Cs157a'].map(normalizeCourseCode))
    .toEqual(['CS 146', 'CS 146', 'CS 146', 'CS 157A']);
  expect(normalizeCourseCode('hello world')).toBeNull();
});
