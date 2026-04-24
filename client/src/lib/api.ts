const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://jassm-admin-app.onrender.com/api';

function getToken() {
  return localStorage.getItem('token');
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
    localStorage.removeItem('token');
    localStorage.removeItem('isAuthenticated');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return res;
}

export default API_BASE;
