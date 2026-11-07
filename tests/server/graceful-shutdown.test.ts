import { describe, it, expect, vi } from 'vitest';
import { performGracefulShutdown } from '../../src/server/utils/graceful-shutdown.js';

describe('Graceful Shutdown Utility', () => {
  it('should close HTTP server, stop scheduler, destroy engines, and exit within 5 seconds', async () => {
    let serverClosed = false;
    let ioClosed = false;
    let schedulerStopped = false;
    let storeSaved = false;
    let enginesDestroyed = false;
    let exitCode: number | null = null;

    const mockServer: any = {
      close: vi.fn((cb?: () => void) => {
        serverClosed = true;
        if (cb) cb();
      })
    };

    const mockIo: any = {
      close: vi.fn((cb?: () => void) => {
        ioClosed = true;
        if (cb) cb();
      })
    };

    const mockScheduler: any = {
      stop: vi.fn(() => {
        schedulerStopped = true;
      })
    };

    const mockStore: any = {
      save: vi.fn(async () => {
        storeSaved = true;
      }),
      destroyAll: vi.fn(async () => {
        enginesDestroyed = true;
      })
    };

    const startTime = Date.now();
    await performGracefulShutdown(
      {
        server: mockServer,
        io: mockIo,
        scheduler: mockScheduler,
        store: mockStore,
        onExit: (code) => {
          exitCode = code;
        }
      },
      5000
    );
    const duration = Date.now() - startTime;

    expect(serverClosed).toBe(true);
    expect(ioClosed).toBe(true);
    expect(schedulerStopped).toBe(true);
    expect(storeSaved).toBe(true);
    expect(enginesDestroyed).toBe(true);
    expect(exitCode).toBe(0);
    expect(duration).toBeLessThan(5000);
  });
});
