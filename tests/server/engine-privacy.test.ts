import { describe, it, expect, vi } from 'vitest';
import EventEmitter from 'node:events';
import { enforceSilentZeroRatio, type TorrentEngine } from '../../src/server/services/engine.js';

describe('Torrent engine privacy and Zero Ratio enforcement', () => {
  it('should lock swarm downloaded and uploaded counters silently to 0', () => {
    const fakeSwarm = new EventEmitter() as any;
    fakeSwarm.downloaded = 100000;
    fakeSwarm.uploaded = 50000;

    const fakeEngine = {
      swarm: fakeSwarm
    } as unknown as TorrentEngine;

    enforceSilentZeroRatio(fakeEngine);

    // Attempting to set downloaded or uploaded must be ignored
    fakeSwarm.downloaded = 9999999;
    fakeSwarm.uploaded = 8888888;

    expect(fakeSwarm.downloaded).toBe(0);
    expect(fakeSwarm.uploaded).toBe(0);
  });

  it('should choke newly connected wires and set wire.uploaded to 0', () => {
    const fakeSwarm = new EventEmitter() as any;
    const fakeEngine = {
      swarm: fakeSwarm
    } as unknown as TorrentEngine;

    enforceSilentZeroRatio(fakeEngine);

    const wire = new EventEmitter() as any;
    wire.uploaded = 5000;
    wire.choke = vi.fn();

    fakeSwarm.emit('wire', wire);

    expect(wire.choke).toHaveBeenCalled();

    // Trying to mutate wire.uploaded must remain 0
    wire.uploaded = 12345;
    expect(wire.uploaded).toBe(0);

    // If wire emits request, wire.choke should be called again
    wire.emit('request');
    expect(wire.choke).toHaveBeenCalledTimes(2);
  });
});
