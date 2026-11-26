// Every call to the backend goes through here.
// Set EXPO_PUBLIC_API_URL to your computer's IP when testing on a real phone,
// e.g. EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 (phones can't reach "localhost").
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let authToken = null;
export function setAuthToken(t) { authToken = t; }

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Can't reach the server. Is the API running?");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  signup: (email, password, displayName) => request('/auth/signup', { method: 'POST', body: { email, password, displayName } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  updateMe: (displayName) => request('/auth/me', { method: 'PATCH', body: { displayName } }),
  searchProfessors: ({ q, department, course, sort } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (department) params.set('department', department);
    if (course) params.set('course', course);
    if (sort) params.set('sort', sort);
    return request(`/professors?${params.toString()}`);
  },
  departments: () => request('/professors/departments'),
  professor: (id, sort = 'recent') => request(`/professors/${id}?sort=${sort}`),
  moreReviews: (id, cursor, sort = 'recent') => request(`/professors/${id}/reviews?cursor=${encodeURIComponent(cursor)}&sort=${sort}`),
  createReview: (id, review) => request(`/professors/${id}/reviews`, { method: 'POST', body: review }),
  updateReview: (id, review) => request(`/professors/${id}/reviews/mine`, { method: 'PUT', body: review }),
  deleteReview: (id) => request(`/professors/${id}/reviews/mine`, { method: 'DELETE' }),
  vote: (reviewId) => request(`/reviews/${reviewId}/helpful`, { method: 'POST' }),
  report: (reviewId, reason) => request(`/reviews/${reviewId}/report`, { method: 'POST', body: { reason } }),
  courses: (q) => request(`/courses?q=${encodeURIComponent(q || '')}`),
  recommendations: (code, preference) => request(`/courses/${encodeURIComponent(code.replace(' ', ''))}/recommendations?preference=${preference}`),
  modQueue: () => request('/moderation/queue'),
  modAction: (id, action) => request(`/moderation/reviews/${id}`, { method: 'POST', body: { action } }),
};
