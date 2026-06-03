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
    const detail = typeof data.detail === 'string' ? data.detail.trim() : '';
    if (typeof msg === 'string' && msg.trim()) {
      const full = detail ? `${msg.trim()} ${detail}` : msg.trim();
      return { message: full, code };
    }

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

export type AiAdvisorStreamDone = {
  provider: string;
  generatedAtUtc: string;
};

type AiAdvisorSsePayload =
  | { type: 'chunk'; text: string }
  | ({ type: 'done' } & AiAdvisorStreamDone)
  | { type: 'error'; code?: string; message: string; detail?: string };

function parseSseBuffer(buffer: string): { events: AiAdvisorSsePayload[]; rest: string } {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: AiAdvisorSsePayload[] = [];
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trimStart();
      if (!raw) continue;
      try {
        events.push(JSON.parse(raw) as AiAdvisorSsePayload);
      } catch {
        // ignore malformed chunk
      }
    }
  }
  return { events, rest };
}

/** POST с ответом text/event-stream (ИИ-советник). */
export async function postAiAdvisorStream(
  auth: AuthApi,
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
): Promise<AiAdvisorStreamDone> {
  const res = await auth.fetchWithAuth(apiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
  assertOk(res);

  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('text/event-stream') || !res.body) {
    if (!res.ok) await throwApiError(res);
    const json = (await res.json()) as { reply?: string; provider?: string; generatedAtUtc?: string };
    if (typeof json.reply === 'string') {
      onChunk(json.reply);
      return {
        provider: json.provider ?? '',
        generatedAtUtc: json.generatedAtUtc ?? new Date().toISOString(),
      };
    }
    throw new ApiError('Unexpected AI response format');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneMeta: AiAdvisorStreamDone | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;
    for (const ev of parsed.events) {
      if (ev.type === 'chunk' && ev.text) onChunk(ev.text);
      if (ev.type === 'done') {
        doneMeta = {
          provider: ev.provider,
          generatedAtUtc: ev.generatedAtUtc,
        };
      }
      if (ev.type === 'error') {
        throw new ApiError(ev.message, ev.code);
      }
    }
  }

  const tail = parseSseBuffer(buffer.includes('\n\n') ? `${buffer}\n\n` : buffer);
  for (const ev of tail.events) {
    if (ev.type === 'chunk' && ev.text) onChunk(ev.text);
    if (ev.type === 'done') {
      doneMeta = { provider: ev.provider, generatedAtUtc: ev.generatedAtUtc };
    }
    if (ev.type === 'error') throw new ApiError(ev.message, ev.code);
  }

  if (!doneMeta) {
    if (!res.ok) await throwApiError(res);
    throw new ApiError('Поток ИИ завершился без ответа');
  }
  if (!res.ok) await throwApiError(res);
  return doneMeta;
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

