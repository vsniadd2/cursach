import type { AuthApi } from '../auth/AuthContext';
import { apiUrl } from './client';

export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

async function readErrorMessage(res: Response) {
  const text = await res.text().catch(() => '');
  try {
    const data = text ? (JSON.parse(text) as any) : null;
    const msg = data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  } catch {
    // ignore
  }
  return `HTTP ${res.status} ${text}`.trim();
}

function assertOk(res: Response) {
  if (res.status === 401) {
    throw new SessionExpiredError();
  }
}

export async function getJson<T>(auth: AuthApi, path: string): Promise<T> {
  const res = await auth.fetchWithAuth(apiUrl(path));
  assertOk(res);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as T;
}

export async function postJson<T>(auth: AuthApi, path: string, body: unknown): Promise<T> {
  const res = await auth.fetchWithAuth(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assertOk(res);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

export async function putJson<T>(auth: AuthApi, path: string, body: unknown): Promise<T | null> {
  const res = await auth.fetchWithAuth(apiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assertOk(res);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function patchJson<T>(
  auth: AuthApi,
  path: string,
  body: unknown
): Promise<T | null> {
  const res = await auth.fetchWithAuth(apiUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assertOk(res);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function deleteJson(auth: AuthApi, path: string): Promise<null> {
  const res = await auth.fetchWithAuth(apiUrl(path), { method: 'DELETE' });
  assertOk(res);
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return null;
}

