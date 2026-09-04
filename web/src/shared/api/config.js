import axios from 'axios';

// REACT_APP_API_URL must be set at build time for a real deployment (e.g. https://api.aercs.app).
// Falling back to the page's own hostname lets local dev work both from localhost and from
// another device on the LAN without any config, since the backend runs on the same host.
const BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8080`;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
