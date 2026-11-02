export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Cineverse-Client': 'web',
      ...options.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'Server không phản hồi đúng định dạng.' }));
  if (!response.ok) throw new Error(data.error ?? 'Không thể thực hiện yêu cầu.');
  return data as T;
}
