const { extractTags } = require('../src/feedback');

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

test('no tags for unrelated text', () => {
  expect(extractTags('I took this class in the spring.')).toEqual([]);
});
