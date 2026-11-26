-- v2: courses as a real table, helpful votes, reports/moderation, roles, sentiment.
-- Written as a migration (not a rewrite) so existing data is carried forward.

CREATE TABLE courses (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,          -- normalized, e.g. "CS 146"
  title         TEXT,
  department_id INTEGER REFERENCES departments(id)
);

CREATE TABLE professor_courses (
  professor_id INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  course_id    INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (professor_id, course_id)
);

-- Move free-text course codes into the courses table, then link reviews by id.
INSERT INTO courses (code) SELECT DISTINCT course_code FROM reviews ON CONFLICT DO NOTHING;
ALTER TABLE reviews ADD COLUMN course_id INTEGER REFERENCES courses(id);
UPDATE reviews r SET course_id = c.id FROM courses c WHERE c.code = r.course_code;
INSERT INTO professor_courses (professor_id, course_id)
  SELECT DISTINCT professor_id, course_id FROM reviews ON CONFLICT DO NOTHING;
ALTER TABLE reviews ALTER COLUMN course_id SET NOT NULL;
ALTER TABLE reviews DROP COLUMN course_code;

ALTER TABLE reviews ADD COLUMN status TEXT NOT NULL DEFAULT 'visible'
  CHECK (status IN ('visible', 'hidden', 'removed'));
ALTER TABLE reviews ADD COLUMN sentiment REAL NOT NULL DEFAULT 0;   -- -1 .. 1
ALTER TABLE reviews ADD COLUMN helpful_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'
  CHECK (role IN ('student', 'moderator'));

-- One helpful vote per user per review, enforced by the primary key.
CREATE TABLE review_votes (
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE review_reports (
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('offensive', 'personal_info', 'spam', 'false_info', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX idx_reviews_course ON reviews (course_id);
CREATE INDEX idx_reviews_status ON reviews (status);
CREATE INDEX idx_reviews_cursor ON reviews (professor_id, created_at DESC, id DESC);
