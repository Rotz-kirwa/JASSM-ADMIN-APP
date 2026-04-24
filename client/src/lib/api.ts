const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://jassm-admin-app.onrender.com/api';

export function getToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

export function setAuthToken(token: string, remember = false) {
  clearAuth();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem('token', token);
}

export function clearAuth() {
  sessionStorage.removeItem('token');
  localStorage.removeItem('token');
  localStorage.removeItem('isAuthenticated');
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return res;
}

export default API_BASE;
