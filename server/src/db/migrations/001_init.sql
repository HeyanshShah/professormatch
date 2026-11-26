-- ProfMatch database schema (PostgreSQL)
-- Normalized: each fact lives in exactly one table, linked by foreign keys.

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- bcrypt hash, never the real password
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE professors (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
  id               SERIAL PRIMARY KEY,
  professor_id     INTEGER NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_code      TEXT NOT NULL,
  rating           SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  difficulty       SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  would_take_again BOOLEAN NOT NULL,
  body             TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
  tags             TEXT[] NOT NULL DEFAULT '{}',  -- auto-generated from the text
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Duplicate-review prevention: one review per student per professor.
  CONSTRAINT one_review_per_user UNIQUE (user_id, professor_id)
);

-- Indexes make lookups fast as the tables grow.
CREATE INDEX idx_professors_name ON professors (lower(name));
CREATE INDEX idx_reviews_professor ON reviews (professor_id);
