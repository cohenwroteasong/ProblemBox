export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON (e.g. the dev proxy can't reach the API).
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? (res.status >= 500 || res.status === 0 ? 'Can’t reach the Kontho server. Is it running?' : `Request failed (${res.status}).`);
    throw new ApiError(res.status, message);
  }
  return data as T;
}
