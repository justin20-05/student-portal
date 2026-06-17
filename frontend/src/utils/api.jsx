import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'delete'].includes(config.method?.toLowerCase())) {
    try {
      const response = await axios.get('http://localhost:5000/api/csrf-token', { withCredentials: true });
      config.headers['X-CSRF-Token'] = response.data.csrfToken;
    } catch (err) {
      console.error('Failed to look up secure CSRF context:', err);
    }
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => Promise.reject(error));

export default api;
