import net from 'node:net';

export async function isPortAvailable(port: number): Promise<boolean> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return false;
  }

  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();

    server.once('error', () => {
      resolve(false);
    });

    server.listen(port, '0.0.0.0', () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

export async function findAvailablePort(preferredPort = 6881): Promise<number> {
  if (await isPortAvailable(preferredPort)) {
    return preferredPort;
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.once('error', (err) => {
      reject(err);
    });

    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to retrieve ephemeral port')));
        return;
      }

      const allocatedPort = address.port;
      server.close(() => {
        resolve(allocatedPort);
      });
    });
  });
}
