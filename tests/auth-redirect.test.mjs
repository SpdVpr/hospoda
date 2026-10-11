import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');

const source = fs.readFileSync(new URL('../src/lib/auth-redirect.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const compiled = { exports: {} };
new Function('exports', 'module', output)(compiled.exports, compiled);
const { authCallbackUrl, safeAuthDestination } = compiled.exports;

test('login and password reset callbacks return to the staff host', () => {
  for (const origin of ['https://team.hospodavesnice.cz', 'http://localhost:3000']) {
    const login = new URL(authCallbackUrl(origin));
    assert.equal(login.origin, origin);
    assert.equal(login.pathname, '/auth/callback');
    assert.equal(login.searchParams.get('next'), '/dashboard');
    assert.equal(new URL(authCallbackUrl(origin, '/nove-heslo')).searchParams.get('next'), '/nove-heslo');
  }
});

test('callback cannot redirect to another host or an arbitrary privileged route', () => {
  assert.equal(safeAuthDestination('/nove-heslo'), '/nove-heslo');
  for (const next of [null, '/dashboard', 'https://example.com', '//example.com', '/\\example.com', '/admin', '/nove-heslo?next=//example.com']) {
    assert.equal(safeAuthDestination(next), '/dashboard');
  }
});

function callbackHarness(error = null) {
  const calls = [];
  const written = [];
  const routeSource = fs.readFileSync(new URL('../src/app/auth/callback/route.ts', import.meta.url), 'utf8');
  const compiledRoute = { exports: {} };
  const js = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'module', js)((name) => {
    if (name === 'next/server') return { NextResponse };
    if (name === 'next/headers') return { cookies: async () => ({ getAll: () => [{ name: 'pkce', value: 'test-verifier' }], set: (...args) => written.push(args) }) };
    if (name === '@/lib/supabase-env') return { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_KEY: 'test-publishable' };
    if (name === '@/lib/auth-redirect') return { safeAuthDestination };
    if (name === '@supabase/ssr') return { createServerClient: (_url, _key, options) => ({ auth: { exchangeCodeForSession: async code => {
      calls.push(code);
      assert.equal(options.cookies.getAll()[0].name, 'pkce');
      assert.equal(options.cookieOptions.sameSite, 'lax');
      assert.equal(options.cookieOptions.domain, undefined);
      if (!error) options.cookies.setAll([{ name: 'session', value: 'test-session', options: { path: '/' } }]);
      return { error };
    } } }) };
    throw new Error('Unexpected dependency: ' + name);
  }, compiledRoute.exports, compiledRoute);
  return { run: url => compiledRoute.exports.GET(new NextRequest(url)), calls, written };
}

test('successful PKCE exchange saves host-only session and preserves password reset destination', async () => {
  const h = callbackHarness();
  const response = await h.run('https://team.hospodavesnice.cz/auth/callback?code=test-code&next=/nove-heslo');
  assert.deepEqual(h.calls, ['test-code']);
  assert.equal(h.written[0][0], 'session');
  assert.equal(response.headers.get('location'), 'https://team.hospodavesnice.cz/nove-heslo');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('invalid or missing login code stays in the attendance app', async () => {
  for (const suffix of ['', '?error=access_denied&code=unused', '?code=expired&next=https://www.hospodavesnice.cz']) {
    const h = callbackHarness({ message: 'expired' });
    const response = await h.run('https://team.hospodavesnice.cz/auth/callback' + suffix);
    assert.equal(response.headers.get('location'), 'https://team.hospodavesnice.cz/?chyba=odkaz');
    assert.equal(h.written.length, 0);
    if (!suffix.includes('expired')) assert.equal(h.calls.length, 0);
  }
});
