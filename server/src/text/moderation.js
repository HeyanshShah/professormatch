// Automatic moderation for reviews before they're saved.
// 1. Profanity/insults, even when disguised: "sh1t", "f.u.c.k", "stuuupid" are
//    normalized (leetspeak -> letters, punctuation removed, repeated letters collapsed).
// 2. Personal information: emails and phone numbers (reviews are about teaching, not doxxing).
// 3. Shouting: mostly ALL CAPS text.
// Returns { ok, reasons[] }. Rejected reviews never reach the database.

const BLOCKED = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'idiot', 'stupid',
  'moron', 'retard', 'dumbass', 'loser', 'ugly', 'fat', 'whore', 'slut', 'kill yourself', 'kys'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

function normalize(text) {
  return String(text).toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c])
    .replace(/(\w)[.\-_*]+(?=\w)/g, '$1')    // f.u.c.k -> fuck
    .replace(/(\w)\1{2,}/g, '$1$1');           // stuuupid -> stuupid
}

function hasBlocked(text) {
  const n = normalize(text);
  const squashed = n.replace(/(\w)\1+/g, '$1'); // stuupid -> stupid (second pass)
  return BLOCKED.filter((w) => {
    const re = new RegExp(`\\b${w.replace(' ', '\\s+')}\\b`);
    return re.test(n) || re.test(squashed);
  });
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

function moderate(text) {
  const reasons = [];
  const bad = hasBlocked(text);
  if (bad.length) reasons.push('offensive language');
  if (EMAIL.test(text) || PHONE.test(text)) reasons.push('personal contact information');
  const letters = String(text).replace(/[^A-Za-z]/g, '');
  if (letters.length >= 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) {
    reasons.push('excessive capital letters');
  }
  return { ok: reasons.length === 0, reasons };
}

module.exports = { moderate, normalize };
