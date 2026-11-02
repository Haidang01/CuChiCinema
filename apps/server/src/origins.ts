export function configuredOrigins(env: NodeJS.ProcessEnv = process.env) {
  const result = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ]);
  for (const value of [env.APP_ORIGIN, ...(env.APP_ORIGINS ?? '').split(',')]) {
    if (!value?.trim()) continue;
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(
        'APP_ORIGIN/APP_ORIGINS phải là origin HTTP(S) đầy đủ, không có đường dẫn, token hay wildcard.',
      );
    result.add(url.origin);
  }
  return result;
}
