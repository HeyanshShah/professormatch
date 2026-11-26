// One place for colors and spacing so every screen looks consistent.
export const colors = {
  bg: '#F6F7FB',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  primary: '#1F3A8A',
  primaryText: '#FFFFFF',
  good: '#15803D',
  ok: '#CA8A04',
  bad: '#B91C1C',
  chip: '#EEF2FF',
};

export const space = (n) => n * 4;

export function ratingColor(r) {
  if (r == null) return colors.muted;
  if (r >= 4) return colors.good;
  if (r >= 3) return colors.ok;
  return colors.bad;
}
