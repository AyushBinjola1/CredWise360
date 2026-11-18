import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const webOrigin = () => process.env.WEB_URL || 'http://127.0.0.1:3000';

export function uniqueUser(label = 'customer') {
  const tag = label.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'customer';
  return {
    name: `Synthetic ${tag}`,
    email: `${tag}.${randomUUID()}@example.test`,
    password: `Demo-Aa9!${randomUUID()}`,
  };
}

/** An isolated, single-origin browser session for integration tests. Paths are relative to /api/. */
export function client(baseURL = webOrigin()) {
  const origin = new URL(baseURL).origin;
  const cookies = new Map();

  async function request(method, path, {body, status = 200, headers = {}} = {}) {
    const url = new URL('/api/' + path.replace(/^\/?(?:api\/)?/, ''), origin);
    const fields = new Headers({Accept: 'application/json'});
    const now = Date.now();
    const pairs = [];
    for (const [name, cookie] of cookies) {
      if (cookie.expires <= now) cookies.delete(name);
      else pairs.push(`${name}=${cookie.value}`);
    }
    if (pairs.length) fields.set('Cookie', pairs.join('; '));
    if (method !== 'GET') {
      fields.set('Content-Type', 'application/json');
      fields.set('Origin', new URL(webOrigin()).origin);
      fields.set('X-CredWise-Action', '1');
    }
    for (const [name, value] of Object.entries(headers)) {
      if (value === null) fields.delete(name);
      else fields.set(name, value);
    }

    const response = await fetch(url, {
      method,
      headers: fields,
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(';');
      const boundary = pair.indexOf('=');
      if (boundary < 1) continue;
      const name = pair.slice(0, boundary).trim();
      const value = pair.slice(boundary + 1);
      const maxAge = attributes.find(attribute => /^\s*max-age=/i.test(attribute));
      const expiry = attributes.find(attribute => /^\s*expires=/i.test(attribute));
      const ends = expiry ? Date.parse(expiry.slice(expiry.indexOf('=') + 1)) : Infinity;
      const expires = maxAge ? Date.now() + 1000 * Number(maxAge.split('=')[1]) : ends;
      if (!value || expires <= Date.now()) cookies.delete(name);
      else cookies.set(name, {value, expires});
    }

    const payload = await response.json();
    assert.equal(response.status, status, `${method} ${url.pathname} returned ${response.status} (${payload.error?.code || 'success'})`);
    if (response.ok) assert.ok(Object.hasOwn(payload, 'data'), 'Missing response data envelope');
    else {
      assert.equal(typeof payload.error?.code, 'string', 'Missing API error code');
      assert.equal(typeof payload.error?.message, 'string', 'Missing API error message');
    }
    return payload;
  }
  return {
    request,
    get: (path, status) => request('GET', path, {status}),
    post: (path, body, status) => request('POST', path, {body, status}),
    put: (path, body, status) => request('PUT', path, {body, status}),
    patch: (path, body, status) => request('PATCH', path, {body, status}),
  };
}

export async function registerCustomer(label = 'customer', session = client()) {
  const credentials = uniqueUser(label);
  const {data} = await session.post('auth/register', credentials, 201);
  return {session, credentials, data};
}
