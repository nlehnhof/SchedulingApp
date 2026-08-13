export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request to ${url} failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function postJSON<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ? JSON.stringify(json.error) : `Request failed (${res.status})`);
  }
  return json;
}
