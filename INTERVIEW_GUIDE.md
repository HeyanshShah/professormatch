# ProfMatch: how to explain it (plain English)

## 30-second pitch
"ProfMatch is a full-stack professor review app: React Native front end, Node/Express API, PostgreSQL.
Beyond the basics, I focused on three things. Fair ranking: a Bayesian average, the same formula IMDb
uses, so one 5-star review doesn't beat forty 4.7s. Recommendations: 'best professor for CS 146 if I
want an easy A', with an explanation. And trust and safety: it auto-moderates profanity even when
disguised, blocks personal info, and lets students report reviews into a moderator queue. It has 36
automated tests against a real Postgres database, runs in Docker, and deploys with one Render blueprint."

## Big ideas, simply
**Bayesian average.** `(C × m + sum of ratings) / (C + n)`. Every professor starts with C=3 imaginary
"average" reviews (m = the average rating across the whole site). With 1 review the result stays near
average; with 40 reviews the real ratings dominate. *Why:* small samples are noisy.

**Recommendations.** Each professor gets 0–100 scores for quality (the Bayesian rating), would-retake %,
and easiness (or rigor if you want a challenge). The preference sets the weights. For example, "Easy A" =
35% quality, 25% retake, 40% easiness. Confidence = review count / 10, capped at 100%. The app shows the bars so it's explainable.

**Sentiment (NLP).** Each word has a score (amazing +3, rude −3). "Very" multiplies the next word,
and a "not" within 3 words flips it. The total is squashed into −1..1 with x/√(x²+15), the VADER approach.

**Moderation.**
- **Normalize disguises first:** 1→i, 0→o, @→a, remove dots between letters, collapse repeated letters ("stuuupid").
- **Whole words only:** "Assessment" or "Scunthorpe" aren't flagged. That's the famous *Scunthorpe problem*, and there's a test for it.
- **Regexes for emails and phone numbers,** plus a caps-ratio check for shouting.

**Cursor pagination.** OFFSET 1000 makes the database read and throw away 1000 rows, and if a new
review arrives mid-scroll you see duplicates. A cursor says "give me 10 reviews older than
(timestamp, id)". It's fast with an index, and it's stable.

**Migrations.** The schema changed from v1 to v2 (courses became a table). Instead of rebuilding, migration 002 creates
`courses`, copies the existing course codes into it, adds a foreign key, backfills it, and drops the old column, all in a
transaction. `schema_migrations` records what has run, so each migration runs only once.

**Integrity in the database, not just the code.**
- **Uniqueness:** UNIQUE(user, professor) blocks duplicate reviews, and the PRIMARY KEY on (review, user) blocks double votes.
- **Value checks:** CHECK(rating 1–5).
- **Why the database:** checks in code can race when two requests arrive at once; database constraints can't.

**Security.** bcrypt, JWT, rate-limited login, Helmet headers, and parameterized SQL (no injection).
The moderator role is checked in the database on every request, so a demotion takes effect immediately.

## Numbers to remember
**36 tests** · **2 migrations** · **3 recommendation modes** · CI runs API tests, the app build, and the Docker build.

## Problems I solved
1. **Unfair rankings:** a new professor with one great review sat at #1. The Bayesian average fixed it, and a test locks it in.
2. **Profanity filter false positives:** substring matching flagged innocent words. Word boundaries plus normalization fixed it.
3. **Course data was free text** ("cs146" vs "CS 146"). I normalized it with a regex and migrated it into a real table without losing data.

## What I'd do next
- **Get real users:** deploy and invite SJSU students.
- **Verify .edu emails.**
- **Better NLP:** train a sentiment model on real reviews once there's data.
- **Push notifications** when someone finds your review helpful.

## Commands
`docker compose up -d db` · `npm run db:seed` · `npm run dev` · `npx expo start` · `npm test`
