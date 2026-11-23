import { vi } from 'vitest';

/**
 * A stand-in for the Agro server, installed as `fetch`.
 *
 * `graphql` maps a field name to the data that field returns (or a function of the request's
 * variables). A query is answered with every listed field it names, so one document asking for
 * several fields gets all of them; anything unlisted is simply absent, which the pages already
 * treat as "nothing yet". `rest` maps a path to `{ status, body }`. Every request is recorded in
 * `calls`, as `{ url, query, variables }`.
 */
export function installFakeServer({ graphql = {}, rest = {} } = {}) {
  const calls = [];
  const reply = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  globalThis.fetch = vi.fn(async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith('/graphql')) {
      const { query = '', variables = {} } = JSON.parse(init.body || '{}');
      calls.push({ url, query, variables });
      const data = {};
      for (const [field, value] of Object.entries(graphql)) {
        if (new RegExp(`\\b${field}\\b`).test(query)) {
          data[field] = typeof value === 'function' ? value(variables) : value;
        }
      }
      return reply(200, { data });
    }
    calls.push({ url, query: '', variables: init.body ? JSON.parse(init.body) : {} });
    const path = url.split('?')[0];
    const route = rest[path];
    return route ? reply(route.status ?? 200, route.body) : reply(404, { error: 'not found' });
  });

  // Signed in: `gql` refuses to send anything without a token, and checks its shape (16+ chars).
  localStorage.setItem('agro.token', 'test-token-0123456789abcdef');

  return {
    calls,
    /** Whether any GraphQL request named `field`. */
    asked: (field) => calls.some((call) => new RegExp(`\\b${field}\\b`).test(call.query)),
    /** Whether any request went to `path`. */
    fetched: (path) => calls.some((call) => call.url.split('?')[0] === path)
  };
}

/** A clipboard that accepts writes, or one that refuses them, on `navigator`. */
export function stubClipboard({ refuse = false } = {}) {
  const writeText = vi.fn(() => (refuse ? Promise.reject(new Error('denied')) : Promise.resolve()));
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}
