# ProfMatch: how to explain it (plain English)

## The 30-second pitch
"ProfMatch is like RateMyProfessors as a mobile app. Students can search professors,
see ratings and reviews, and post their own. The front end is React Native with Expo,
the backend is a Node.js/Express REST API, and the data lives in PostgreSQL. I focused
on doing the fundamentals right: a normalized database, real authentication with
hashed passwords and JWTs, preventing duplicate reviews at the database level, and
automatically turning review text into tags like 'Clear lectures' or 'Tough grader'."

## The 3 parts, in normal words
1. **The app (mobile/)**: what you see. Built with React Native, so one JavaScript
   codebase runs on iPhone, Android, and web. Expo handles building and running it.
   Screens: login/signup, search, professor page, write review, profile.
2. **The API (server/)**: the middleman. The app never talks to the database directly.
   It sends requests like "GET /professors?q=patel" and the API checks permissions,
   validates input, runs SQL, and sends back JSON.
3. **The database (PostgreSQL)**: stores everything in 4 tables: users, departments,
   professors, reviews.

## Things they'll ask about
**"What does normalized mean?"**
Each fact is stored once. A review stores `professor_id`, not the professor's name, so if
a name changes you update one row, not hundreds. Tables connect through foreign keys.

**"How does login work?"**
1. On signup, the password is hashed with bcrypt, a one-way scramble. The database
   never stores the real password, so even if it leaked, passwords stay safe.
2. On login, bcrypt checks the typed password against the hash.
3. If it matches, the server creates a JWT: a signed digital pass saying "this is user
   #5", valid for 7 days. The app stores it in the phone's secure keychain.
4. Every request after that sends the JWT. The server verifies the signature, so no
   one can fake one.
Bonus points: same error for "wrong email" and "wrong password" (so attackers can't find
which emails exist), and rate limiting (20 attempts per 15 minutes).

**"How do you prevent duplicate reviews?"**
A UNIQUE constraint on (user_id, professor_id) in the database. Even if two requests
arrived at the exact same moment, the database itself refuses the second one. The API
catches that error (Postgres code 23505) and returns 409 Conflict, and the app shows
"Edit your review" instead of "Write a review". Checking in the database is safer than
only checking in code, because code checks can race.

**"What's the text-based feedback parsing?"**
Each tag has trigger phrases. "Clear lectures" ← "clear", "great examples", "easy to
follow". When a review is saved, the server scans the text and attaches tags. It handles
negation: "not clear" does NOT get the "Clear lectures" tag because it checks the word
before the match. The professor page counts tags across all reviews to show the top 5.

**"How did you make it fast?"**
- Averages are computed by the database in one SQL query, not by downloading all reviews.
- Indexes on professor name and review professor_id.
- Search waits 300ms after you stop typing (debouncing) so it doesn't hit the API on
  every keystroke.
- FlatList only renders rows that are on screen; rows are memoized so they don't
  re-render needlessly.

**"How did you prevent SQL injection?"**
Parameterized queries: `WHERE email = $1` with the value passed separately, so user input
is never pasted into SQL as code.

**"How did you test it?"**
18 automated tests with Jest and Supertest that hit the real API and a real test
database: signup/login, wrong password, password actually hashed, protected routes reject
missing/fake tokens, search, filters, posting a review, duplicate blocked, invalid
rating rejected, edit and delete, plus tagger tests including negation.

## A problem I hit
"My tagger was matching 'clear' inside 'not clear', so negative reviews got positive
tags. I fixed it by capturing the word right before each match and skipping it if it's a
negation like 'not' or 'never', and I added a test for that exact case."

## What I'd improve
- Pagination / infinite scroll for big schools
- Verify .edu emails with a confirmation link
- Report/moderation for abusive reviews
- Use an NLP model for sentiment instead of phrase lists
- Deploy: API on Render/Fly.io, database on Supabase/Neon, app via Expo EAS

## Commands to remember
- `npm run dev` (in server/) starts the API
- `npm run db:seed` resets demo data
- `npx expo start` (in mobile/) starts the app
- `npm test` runs the tests
