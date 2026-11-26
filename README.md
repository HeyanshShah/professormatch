# ProfMatch

[![tests](https://github.com/HeyanshShah/professormatch/actions/workflows/tests.yml/badge.svg)](https://github.com/HeyanshShah/professormatch/actions/workflows/tests.yml)

A full-stack mobile app for finding and reviewing professors. It ranks professors fairly with a
**Bayesian average**, recommends the best professor for a course based on what you want,
analyzes review text with NLP (tags + sentiment), and moderates content automatically.

![screens](docs/screens.png)

## Features
- **Fair rankings:** a Bayesian average (the IMDb Top-250 formula) stops a professor with one 5★ review
  from outranking one with 40 reviews averaging 4.7.
- **Recommendations:** "best professor for CS 146" for an *Easy A*, *Balanced*, or *Learn the most*
  preference. Each result shows a match %, a confidence level based on review count, and an explanation of *why*.
- **Review NLP:**
  - **Auto-tags** like "Clear lectures" or "Tough grader", with negation handling ("not clear" doesn't count).
  - **Sentiment** scoring using a VADER-style lexicon with negation and intensifiers.
  - **Tone summary** per professor (% positive / negative).
- **Moderation:**
  - **Blocks disguised profanity** ("1d10t", "f.u.c.k", "stuuupid") using leetspeak normalization.
  - **Blocks personal info** (emails, phone numbers) and shouting.
  - **Student reports** auto-hide a review after 3 reports, and a moderator role restores or removes it.
- **Helpful votes:** one per student per review, enforced by a primary key, so you can't vote on your own review.
- **Courses as first-class data:**
  - **Search by course code** ("cs146", "CS-146", and "CS 146" all match).
  - **Professor ↔ course** links.
- **Infinite scroll** with **keyset (cursor) pagination**, which stays fast and never duplicates or skips rows the way OFFSET can.
- **Secure auth:**
  - **Credentials:** bcrypt hashing and 7-day JWTs stored in the phone's secure keychain.
  - **Abuse limits:** login rate limiting.
  - **Hardening:** Helmet security headers, parameterized SQL, server-side validation, and DB-checked roles.
- **Duplicate reviews prevented** by `UNIQUE (user_id, professor_id)`; the app offers "Edit" instead.

## Tech stack
| Layer | Tech |
|---|---|
| Mobile | React Native, Expo, React Navigation, React Context, expo-secure-store |
| API | Node.js, Express, JWT, bcrypt, Helmet, express-rate-limit |
| Database | PostgreSQL: normalized schema, foreign keys, CHECK/UNIQUE constraints, indexes, **versioned migrations** |
| DevOps | Docker, docker-compose, Render Blueprint, GitHub Actions (API tests on a Postgres service container + app build + Docker build) |
| Testing | Jest + Supertest: **36 tests** against a real Postgres database |

## Architecture
```
 React Native app ── HTTPS/JSON + Bearer JWT ──▶ Express API ── pooled, parameterized SQL ──▶ PostgreSQL
                                                  │
                                    tags · sentiment · moderation · Bayesian ranking
```
**Schema:**
- `users`
- `departments`
- `professors`
- `courses`
- `professor_courses` (many-to-many)
- `reviews`: FKs to all of the above, plus status, sentiment, tags and helpful_count
- `review_votes`
- `review_reports`
- `schema_migrations`

Migration `002` shows a real data migration: it moves free-text course codes into a `courses` table,
backfills foreign keys, and drops the old column. A test proves v1 data survives the upgrade.

## API (highlights)
| Method | Path | Notes |
|---|---|---|
| GET | `/professors?q=&course=&department=&sort=best\|most_reviewed\|easiest` | Bayesian-ranked search |
| GET | `/professors/:id` · `/professors/:id/reviews?cursor=&sort=recent\|helpful` | details · infinite scroll |
| POST/PUT/DELETE | `/professors/:id/reviews[/mine]` | moderated, tagged, sentiment-scored |
| GET | `/courses?q=` · `/courses/:code/recommendations?preference=` | course search · recommendations |
| POST | `/reviews/:id/helpful` · `/reviews/:id/report` | toggle vote · report |
| GET/POST | `/moderation/queue` · `/moderation/reviews/:id` | moderators only |
| POST/GET/PATCH | `/auth/signup` · `/auth/login` · `/auth/me` | |

## Run it
```bash
docker compose up -d db            # PostgreSQL
cd server && cp .env.example .env && npm install
npm run db:seed                    # migrations + demo data
npm run dev                        # API on :4000
cd ../mobile && npm install && npx expo start   # press w for web, or scan with Expo Go
```
Demo logins: `demo1@sjsu.edu` / `password123` · moderator: `mod@sjsu.edu` / `password123`.
Demo reviews are generated (deterministic, clearly fake) so the rankings have something to show.

**Deploy:** in Render, choose New → Blueprint and pick this repo. `render.yaml` creates the free Postgres database and the API, and the
container runs migrations on start.

## Tests
```bash
cd server && npm test     # needs Postgres; set TEST_DATABASE_URL
```
The 36 tests cover:
- **Migrations:** v1→v2 data migration, idempotency.
- **Auth:** hashing, tokens, security headers.
- **Ranking:** Bayesian ordering, course and department search, recommendations.
- **Reviews:** moderation (disguised profanity, PII, shouting, the Scunthorpe problem), sentiment, tags, cursor pagination, votes.
- **Reporting:** auto-hide, then moderator restore.
