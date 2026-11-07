declare module 'torrent-stream' {
  import { EventEmitter } from 'node:events';

  interface TorrentStreamFile extends EventEmitter {
    name: string;
    path: string;
    length: number;
    select(priority?: number): void;
    deselect(): void;
    createReadStream(options?: { start?: number; end?: number }): NodeJS.ReadableStream;
  }

  interface TorrentStreamOptions {
    connections?: number;
    uploads?: number;
    tmp?: string;
    path?: string;
    verify?: boolean;
    dht?: boolean;
    tracker?: boolean;
    trackers?: string[];
    port?: number;
  }

  interface TorrentEngineInstance extends EventEmitter {
    files: TorrentStreamFile[];
    torrent?: any;
    ready: boolean;
    infoHash: string;
    swarm: any;
    bitfield: any;
    selection: any[];
    port?: number;
    destroy(cb?: () => void): void;
    remove(keepPieces: boolean, cb?: () => void): void;
    listen(port: number, cb?: () => void): void;
    select(from?: number, to?: number, priority?: number): void;
    deselect(from?: number, to?: number, priority?: number): void;
  }

  function torrentStream(
    source: string | Buffer | object,
    options?: TorrentStreamOptions
  ): TorrentEngineInstance;

  export default torrentStream;
}
