import type { Request } from 'express';

/**
 * Extracts and constructs the fully qualified, authenticated base URL
 * (e.g. `https://user:pass@domain.com` or `http://localhost:9000`)
 * supporting HTTP Basic Auth (.htaccess, Nginx, Traefik), reverse proxy headers,
 * and optional fallback environment variables.
 */
export function getAuthenticatedBaseUrl(req: Request): string {
  // 1. Determine protocol (supporting X-Forwarded-Proto)
  const forwardedProto = req.headers['x-forwarded-proto'];
  let protocol = 'http';
  if (typeof forwardedProto === 'string') {
    protocol = forwardedProto.split(',')[0].trim();
  } else if (req.protocol) {
    protocol = req.protocol;
  }

  // 2. Determine host (supporting X-Forwarded-Host)
  const forwardedHost = req.headers['x-forwarded-host'];
  let host = 'localhost:9000';
  if (typeof forwardedHost === 'string') {
    host = forwardedHost.split(',')[0].trim();
  } else {
    host = req.get('host') || 'localhost:9000';
  }

  // 3. Extract credentials (query param, Basic Auth header, or environment variables)
  let credentials = '';
  const encodePart = (str: string) =>
    encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

  const queryAuth = typeof req.query?.auth === 'string' ? req.query.auth.trim() : '';
  const authHeader = req.headers.authorization;

  if (queryAuth) {
    if (queryAuth.includes(':')) {
      const colonIdx = queryAuth.indexOf(':');
      credentials = `${encodePart(queryAuth.slice(0, colonIdx))}:${encodePart(queryAuth.slice(colonIdx + 1))}`;
    } else {
      // Possible base64
      try {
        const decoded = Buffer.from(queryAuth, 'base64').toString('utf-8');
        if (decoded.includes(':')) {
          const colonIdx = decoded.indexOf(':');
          credentials = `${encodePart(decoded.slice(0, colonIdx))}:${encodePart(decoded.slice(colonIdx + 1))}`;
        }
      } catch {}
    }
  }

  if (!credentials && authHeader && authHeader.startsWith('Basic ')) {
    try {
      const b64 = authHeader.slice(6).trim();
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        const user = decoded.slice(0, colonIdx);
        const pass = decoded.slice(colonIdx + 1);
        credentials = `${encodePart(user)}:${encodePart(pass)}`;
      }
    } catch {
      // Ignore decoding failure
    }
  }

  if (!credentials) {
    const cleanVal = (val?: string) => (val ? val.trim().replace(/^["']|["']$/g, '') : '');
    const rawEnv = cleanVal(process.env.PUBLIC_AUTH_CREDENTIALS || process.env.BASIC_AUTH);
    if (rawEnv && rawEnv.includes(':')) {
      const colonIdx = rawEnv.indexOf(':');
      const user = rawEnv.slice(0, colonIdx).trim();
      const pass = rawEnv.slice(colonIdx + 1).trim();
      credentials = `${encodePart(user)}:${encodePart(pass)}`;
    } else if (process.env.HTTP_AUTH_USER && process.env.HTTP_AUTH_PASSWORD) {
      const user = cleanVal(process.env.HTTP_AUTH_USER);
      const pass = cleanVal(process.env.HTTP_AUTH_PASSWORD);
      if (user && pass) {
        credentials = `${encodePart(user)}:${encodePart(pass)}`;
      }
    }
  }

  return `${protocol}://${credentials ? credentials + '@' : ''}${host}`;
}
