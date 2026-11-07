import type { SystemStatusDTO } from '../../shared/types.js';

/**
 * Returns the fully qualified external base URL including authentication credentials
 * if available (e.g. `https://user:pass@domain.com`).
 */
export function getExternalBaseUrl(systemStatus?: SystemStatusDTO | null): string {
  if (systemStatus?.authenticatedOrigin) {
    return systemStatus.authenticatedOrigin;
  }

  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  return 'http://localhost:9000';
}
