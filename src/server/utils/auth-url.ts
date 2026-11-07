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

  // 3. Extract credentials (Basic Auth header or fallback environment variable)
  let credentials = '';
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const b64 = authHeader.slice(6).trim();
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx !== -1) {
        const user = decoded.slice(0, colonIdx);
        const pass = decoded.slice(colonIdx + 1);
        const encodePart = (str: string) => encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
        credentials = `${encodePart(user)}:${encodePart(pass)}`;
      }
    } catch {
      // Ignore decoding failure
    }
  } else if (process.env.PUBLIC_AUTH_CREDENTIALS) {
    const raw = process.env.PUBLIC_AUTH_CREDENTIALS.trim();
    const colonIdx = raw.indexOf(':');
    if (colonIdx !== -1) {
      const user = raw.slice(0, colonIdx);
      const pass = raw.slice(colonIdx + 1);
      const encodePart = (str: string) => encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      credentials = `${encodePart(user)}:${encodePart(pass)}`;
    }
  }

  return `${protocol}://${credentials ? credentials + '@' : ''}${host}`;
}
