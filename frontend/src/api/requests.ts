import type { AuthApi } from '../auth/AuthContext';
import { apiUrl } from './client';

export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

export class ApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function readErrorBody(res: Response): Promise<{ message: string; code?: string }> {
  const text = await res.text().catch(() => '');
  try {
    const data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    if (!data) return { message: `HTTP ${res.status}`.trim() };

    const code = typeof data.code === 'string' ? data.code : undefined;
    const msg = data.message;
    if (typeof msg === 'string' && msg.trim()) return { message: msg.trim(), code };

    const errors = data.errors as Record<string, string[] | string> | undefined;
    if (errors && typeof errors === 'object') {
      const parts: string[] = [];
      for (const value of Object.values(errors)) {
        if (Array.isArray(value)) parts.push(...value.filter((x) => typeof x === 'string'));
        else if (typeof value === 'string') parts.push(value);
      }
      if (parts.length) return { message: parts.join(' '), code };
    }

    const title = data.title;
    if (typeof title === 'string' && title.trim() && title !== 'One or more validation errors occurred.')
      return { message: title.trim(), code };
  } catch {
    // ignore
  }
  return { message: `HTTP ${res.status} ${text}`.trim() };
}

async function readErrorMessage(res: Response) {
  return (await readErrorBody(res)).message;
}

async function throwApiError(res: Response): Promise<never> {
  const body = await readErrorBody(res);
  throw new ApiError(body.message, body.code);
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
    await throwApiError(res);
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
  if (!res.ok) await throwApiError(res);
  return (await res.json()) as T;
}

export async function putJson<T>(auth: AuthApi, path: string, body: unknown): Promise<T | null> {
  const res = await auth.fetchWithAuth(apiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assertOk(res);
  if (!res.ok) await throwApiError(res);
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
    await throwApiError(res);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function deleteJson(auth: AuthApi, path: string): Promise<null> {
  const res = await auth.fetchWithAuth(apiUrl(path), { method: 'DELETE' });
  assertOk(res);
  if (!res.ok) await throwApiError(res);
  return null;
}

export async function downloadBlob(
  auth: AuthApi,
  path: string,
  fallbackFileName: string,
): Promise<{ blob: Blob; fileName: string }> {
  const res = await auth.fetchWithAuth(apiUrl(path));
  assertOk(res);
  if (!res.ok) await throwApiError(res);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const fileName = match?.[1]?.trim().replace(/"/g, '') || fallbackFileName;
  return { blob, fileName };
}

