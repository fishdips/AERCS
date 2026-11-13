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

// ---------------------------------------------------------------------------
// GET response cache
//
// Pages fetch their data when they mount, so without a cache every navigation click, modal
// open or revisit hits the server again. Successful GETs are kept for a short time and
// identical requests already in flight share one network call. Any write (POST / PUT / PATCH /
// DELETE) clears the whole cache, so data reloaded after a user's own action is always fresh.
//
// Opt out per call with `api.get(url, { cache: false })`. File downloads (blob / arraybuffer)
// and requests carrying a `_t` cache-buster are never cached.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 100;

const cache = new Map(); // key -> { expires, response }
const inflight = new Map(); // key -> Promise
let generation = 0; // bumped on every clear so a request started before a write is never stored

const rawGet = api.get.bind(api);

function copyData(data) {
  if (data === null || typeof data !== 'object') return data;
  return typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data));
}

// Callers get their own copy of `data`, so one page mutating its list (sorting in place,
// for example) can never change what another page reads from the cache.
function withOwnData(response) {
  return { ...response, data: copyData(response.data) };
}

export function clearApiCache() {
  cache.clear();
  inflight.clear();
  generation += 1;
}

api.get = (url, config = {}) => {
  const { cache: useCache = true, ...axiosConfig } = config;
  const binary = axiosConfig.responseType === 'blob' || axiosConfig.responseType === 'arraybuffer';
  if (!useCache || binary || axiosConfig.params?._t) {
    return rawGet(url, axiosConfig);
  }

  const key = `${url}?${JSON.stringify(axiosConfig.params ?? {})}`;

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return Promise.resolve(withOwnData(hit.response));
  }
  cache.delete(key);

  let pending = inflight.get(key);
  if (!pending) {
    const startedIn = generation;
    pending = rawGet(url, axiosConfig)
      .then((response) => {
        if (startedIn === generation) {
          if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
          cache.set(key, { expires: Date.now() + CACHE_TTL_MS, response });
        }
        return response;
      })
      .finally(() => {
        if (inflight.get(key) === pending) inflight.delete(key);
      });
    inflight.set(key, pending);
  }
  return pending.then(withOwnData);
};

const invalidateOnWrite = (config) => {
  const method = config?.method?.toLowerCase();
  if (method && method !== 'get') clearApiCache();
};

api.interceptors.response.use(
  (response) => {
    invalidateOnWrite(response.config);
    return response;
  },
  (error) => {
    // A failed write may still have changed something on the server.
    invalidateOnWrite(error.config);
    return Promise.reject(error);
  },
);

export default api;
