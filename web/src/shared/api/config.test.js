import api, { clearApiCache } from './config';

// Replaces the network with a counter so the tests can see how many requests really go out.
function stubAdapter(respond = (config) => ({ list: [config.url] })) {
  const calls = [];
  api.defaults.adapter = (config) => {
    calls.push(`${(config.method || 'get').toUpperCase()} ${config.url}`);
    return Promise.resolve({
      data: respond(config),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
  };
  return calls;
}

beforeEach(() => {
  clearApiCache();
});

test('repeated GETs of the same url hit the network once', async () => {
  const calls = stubAdapter();
  await api.get('/api/activities');
  await api.get('/api/activities');
  expect(calls).toEqual(['GET /api/activities']);
});

test('concurrent identical GETs share one request', async () => {
  const calls = stubAdapter();
  await Promise.all([api.get('/api/activities'), api.get('/api/activities')]);
  expect(calls).toHaveLength(1);
});

test('different params are cached separately', async () => {
  const calls = stubAdapter();
  await api.get('/api/evidence/repository', { params: { page: 0 } });
  await api.get('/api/evidence/repository', { params: { page: 1 } });
  await api.get('/api/evidence/repository', { params: { page: 0 } });
  expect(calls).toHaveLength(2);
});

test('a write clears the cache so the next GET is fresh', async () => {
  const calls = stubAdapter();
  await api.get('/api/activities');
  await api.post('/api/activities', {});
  await api.get('/api/activities');
  expect(calls).toEqual(['GET /api/activities', 'POST /api/activities', 'GET /api/activities']);
});

test('a failed write also clears the cache', async () => {
  const calls = stubAdapter();
  await api.get('/api/activities');
  api.defaults.adapter = (config) => Promise.reject(Object.assign(new Error('boom'), { config }));
  await expect(api.delete('/api/activities/1')).rejects.toThrow('boom');
  api.defaults.adapter = (config) => {
    calls.push(`GET ${config.url}`);
    return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
  };
  await api.get('/api/activities');
  expect(calls).toHaveLength(2);
});

test('a GET that started before a write is not stored', async () => {
  let release;
  const calls = [];
  api.defaults.adapter = (config) => {
    calls.push(`${config.method} ${config.url}`);
    if (config.method === 'get' && calls.filter((c) => c.startsWith('get')).length === 1) {
      return new Promise((resolve) => {
        release = () => resolve({ data: { stale: true }, status: 200, statusText: 'OK', headers: {}, config });
      });
    }
    return Promise.resolve({ data: { fresh: true }, status: 200, statusText: 'OK', headers: {}, config });
  };

  const slow = api.get('/api/activities');
  await api.post('/api/activities', {});
  release();
  await slow;

  const next = await api.get('/api/activities');
  expect(next.data).toEqual({ fresh: true });
});

test('callers get their own copy of the data', async () => {
  stubAdapter(() => ({ list: [3, 1, 2] }));
  const first = await api.get('/api/activities');
  first.data.list.sort();
  first.data.list.push(99);
  const second = await api.get('/api/activities');
  expect(second.data.list).toEqual([3, 1, 2]);
});

test('blob downloads, _t cache-busters and cache:false are never cached', async () => {
  const calls = stubAdapter();
  await api.get('/api/evidence/1/view', { responseType: 'blob' });
  await api.get('/api/evidence/1/view', { responseType: 'blob' });
  await api.get('/api/accreditor/links/1', { params: { _t: 1 } });
  await api.get('/api/accreditor/links/1', { params: { _t: 2 } });
  await api.get('/api/dashboard/summary', { cache: false });
  await api.get('/api/dashboard/summary', { cache: false });
  expect(calls).toHaveLength(6);
});
