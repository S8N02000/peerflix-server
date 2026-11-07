declare module 'parse-torrent' {
  export interface Instance {
    infoHash: string;
    name?: string;
    announce?: string[];
    urlList?: string[];
    length?: number;
    files?: Array<{
      path: string;
      name: string;
      length: number;
      offset: number;
    }>;
    pieces?: string[];
    pieceLength?: number;
    lastPieceLength?: number;
  }

  export function toMagnetURI(parsed: Instance): string;
  export function toTorrentFile(parsed: Instance): Buffer;

  function parseTorrent(torrent: string | Buffer | Instance): Promise<Instance> & Instance;

  export default parseTorrent;
}
