import { describe, it, expect } from 'vitest';
import net from 'node:net';
import { findAvailablePort, isPortAvailable } from '../../src/server/services/port-finder.js';

describe('Port finder service', () => {
  it('should return two distinct and valid ports when preferred port is occupied', async () => {
    const occupiedServer = net.createServer();
    const occupiedPort = await new Promise<number>((resolve) => {
      occupiedServer.listen(0, '0.0.0.0', () => {
        const addr = occupiedServer.address();
        resolve(typeof addr === 'object' && addr ? addr.port : 0);
      });
    });

    expect(occupiedPort).toBeGreaterThan(0);

    // Call findAvailablePort asking for the occupied port
    const port1 = await findAvailablePort(occupiedPort);
    expect(port1).not.toBe(occupiedPort);
    expect(port1).toBeGreaterThan(0);
    expect(port1).toBeLessThanOrEqual(65535);

    // Occupy port1 as well
    const occupiedServer2 = net.createServer();
    await new Promise<void>((resolve) => {
      occupiedServer2.listen(port1, '0.0.0.0', () => resolve());
    });

    const port2 = await findAvailablePort(occupiedPort);
    expect(port2).not.toBe(occupiedPort);
    expect(port2).not.toBe(port1);
    expect(port2).toBeGreaterThan(0);
    expect(port2).toBeLessThanOrEqual(65535);

    await new Promise<void>((resolve) => occupiedServer.close(() => resolve()));
    await new Promise<void>((resolve) => occupiedServer2.close(() => resolve()));
  });

  it('should handle invalid port numbers gracefully by returning a valid ephemeral port or false in isPortAvailable', async () => {
    const availableNegative = await isPortAvailable(-1);
    expect(availableNegative).toBe(false);

    const availableTooHigh = await isPortAvailable(70000);
    expect(availableTooHigh).toBe(false);

    const availableFloat = await isPortAvailable(6881.5);
    expect(availableFloat).toBe(false);

    // Calling findAvailablePort with invalid port falls back to an ephemeral valid port
    const fallbackPort = await findAvailablePort(-5);
    expect(fallbackPort).toBeGreaterThan(0);
    expect(fallbackPort).toBeLessThanOrEqual(65535);
  });
});
