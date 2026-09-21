import net from "net";
import {
  SSH_ENABLED,
  SSH_HOST,
  SSH_PORT,
  SSH_USER,
  SSH_PASSWORD,
  SSH_PRIVATE_KEY,
  SSH_REMOTE_HOST,
  SSH_REMOTE_PORT,
  SSH_LOCAL_PORT,
} from "../config/env";

let SshClientClass: any;
try {
  SshClientClass = require("ssh2").Client;
} catch {
  SshClientClass = class DummyClient {
    once() {}
    on() {}
    connect() {}
    end() {}
  };
}

export interface SSHTunnelConfig {
  host: string;
  port?: number;
  username: string;

  // Use one of these authentication methods.
  password?: string;
  privateKey?: string;

  // The database address as seen FROM the SSH server.
  remoteHost: string;
  remotePort: number;

  // Optional. If omitted, an available local port is selected.
  localPort?: number;
}

export interface SSHTunnel {
  connectionId: string;
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  close: () => Promise<void>;
}

export interface SSHTunnelStatus {
  enabled: boolean;
  connected: boolean;
  connecting: boolean;
  connectionId: string;
  host: string;
  port: number;
  username: string;
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  connectedAt: string | null;
  uptimeSeconds: number | null;
  lastError: string | null;
}

interface ActiveTunnel {
  sshClient: any;
  server: net.Server | null;
  tunnel: SSHTunnel;
  connectedAt: Date;
  isExplicitClose: boolean;
  config: SSHTunnelConfig;
}

class SSHTunnelService {
  private activeTunnels = new Map<string, ActiveTunnel>();
  private inFlightPromises = new Map<string, Promise<SSHTunnel>>();
  private lastErrors = new Map<string, string>();
  private reconnectTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Return the default SSH configuration for the MailWizz server.
   */
  getDefaultConfig(): SSHTunnelConfig {
    return {
      host: SSH_HOST,
      port: SSH_PORT,
      username: SSH_USER,
      ...(SSH_PASSWORD ? { password: SSH_PASSWORD } : {}),
      ...(SSH_PRIVATE_KEY ? { privateKey: SSH_PRIVATE_KEY } : {}),
      remoteHost: SSH_REMOTE_HOST,
      remotePort: SSH_REMOTE_PORT,
      localPort: SSH_LOCAL_PORT,
    };
  }

  /**
   * Helper to check if a TCP port is currently accepting connections.
   */
  async isPortOpen(port: number, host = "127.0.0.1", timeoutMs = 1200): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const finish = (result: boolean) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      socket.setTimeout(timeoutMs);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
      socket.connect(port, host);
    });
  }

  /**
   * Ensure that the default MailWizz server SSH tunnel is active.
   * Automatically establishes the server connection before database queries.
   */
  async ensureDefaultTunnel(forceReconnect = false): Promise<SSHTunnel> {
    const connectionId = "default_mailwizz";

    if (!SSH_ENABLED) {
      console.log("[SSH Tunnel] SSH tunnel is disabled by configuration (SSH_ENABLED=false)");
      return {
        connectionId,
        localHost: "127.0.0.1",
        localPort: SSH_LOCAL_PORT,
        remoteHost: SSH_REMOTE_HOST,
        remotePort: SSH_REMOTE_PORT,
        close: async () => {},
      };
    }

    if (forceReconnect) {
      await this.closeTunnel(connectionId);
    }

    const existing = this.activeTunnels.get(connectionId);
    if (existing) {
      return existing.tunnel;
    }

    // Reuse existing in-flight connection promise if concurrent requests arrive
    const inFlight = this.inFlightPromises.get(connectionId);
    if (inFlight) {
      return inFlight;
    }

    const config = this.getDefaultConfig();

    // Check if the local port is already open (e.g. from an existing background tunnel or external process)
    const targetPort = config.localPort || 3307;
    const isAlreadyListening = await this.isPortOpen(targetPort, "127.0.0.1");

    if (isAlreadyListening && !forceReconnect) {
      console.log(`[SSH Tunnel] Port ${targetPort} is already active on localhost. Using existing port forwarding.`);
      const tunnel: SSHTunnel = {
        connectionId,
        localHost: "127.0.0.1",
        localPort: targetPort,
        remoteHost: config.remoteHost,
        remotePort: config.remotePort,
        close: async () => {
          await this.closeTunnel(connectionId);
        },
      };

      this.activeTunnels.set(connectionId, {
        sshClient: null,
        server: null,
        tunnel,
        connectedAt: new Date(),
        isExplicitClose: false,
        config,
      });

      return tunnel;
    }

    const connectPromise = this.createTunnel(connectionId, config)
      .then((tunnel) => {
        this.inFlightPromises.delete(connectionId);
        this.lastErrors.delete(connectionId);
        console.log(`[SSH Tunnel] ✓ Server login connected successfully! ${config.username}@${config.host}:${config.port ?? 22} -> local :${tunnel.localPort} -> remote :${tunnel.remotePort}`);
        return tunnel;
      })
      .catch((err) => {
        this.inFlightPromises.delete(connectionId);
        this.lastErrors.set(connectionId, err?.message || String(err));
        console.error(`[SSH Tunnel] ✗ Server login failed (${config.username}@${config.host}:${config.port ?? 22}):`, err?.message || err);
        throw err;
      });

    this.inFlightPromises.set(connectionId, connectPromise);
    return connectPromise;
  }

  /**
   * Ensure that an SSH server tunnel is active for custom connection credentials.
   */
  async ensureCustomTunnel(
    config: SSHTunnelConfig,
    connectionId: string,
    forceReconnect = false
  ): Promise<SSHTunnel> {
    if (forceReconnect) {
      await this.closeTunnel(connectionId);
    }

    const existing = this.activeTunnels.get(connectionId);
    if (existing) {
      return existing.tunnel;
    }

    const inFlight = this.inFlightPromises.get(connectionId);
    if (inFlight) {
      return inFlight;
    }

    const targetPort = config.localPort || (await this.findAvailablePort());
    config.localPort = targetPort;

    const isAlreadyListening = await this.isPortOpen(targetPort, "127.0.0.1");

    if (isAlreadyListening && !forceReconnect) {
      const tunnel: SSHTunnel = {
        connectionId,
        localHost: "127.0.0.1",
        localPort: targetPort,
        remoteHost: config.remoteHost,
        remotePort: config.remotePort,
        close: async () => {
          await this.closeTunnel(connectionId);
        },
      };

      this.activeTunnels.set(connectionId, {
        sshClient: null,
        server: null,
        tunnel,
        connectedAt: new Date(),
        isExplicitClose: false,
        config,
      });

      return tunnel;
    }

    const connectPromise = this.createTunnel(connectionId, config)
      .then((tunnel) => {
        this.inFlightPromises.delete(connectionId);
        this.lastErrors.delete(connectionId);
        console.log(`[SSH Tunnel] ✓ Custom tunnel connected! ${config.username}@${config.host}:${config.port ?? 22} -> local :${tunnel.localPort}`);
        return tunnel;
      })
      .catch((err) => {
        this.inFlightPromises.delete(connectionId);
        this.lastErrors.set(connectionId, err?.message || String(err));
        console.error(`[SSH Tunnel] ✗ Custom tunnel failed (${config.username}@${config.host}:${config.port ?? 22}):`, err?.message || err);
        throw err;
      });

    this.inFlightPromises.set(connectionId, connectPromise);
    return connectPromise;
  }

  /**
   * Create an SSH local port forwarding tunnel.
   *
   * Equivalent to:
   * ssh -L LOCAL_PORT:REMOTE_HOST:REMOTE_PORT user@SSH_HOST
   */
  async createTunnel(
    connectionId: string,
    config: SSHTunnelConfig
  ): Promise<SSHTunnel> {
    const existing = this.activeTunnels.get(connectionId);
    if (existing) {
      return existing.tunnel;
    }

    // Cancel any pending reconnect timers for this connection
    const pendingTimer = this.reconnectTimers.get(connectionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.reconnectTimers.delete(connectionId);
    }

    const localHost = "127.0.0.1";
    const localPort = config.localPort ?? (await this.findAvailablePort());

    const sshClient = new SshClientClass();

    const connectConfig: any = {
      host: config.host,
      port: config.port ?? 22,
      username: config.username,
      keepaliveInterval: 15000,
      readyTimeout: 30000,
      ...(config.password ? { password: config.password } : {}),
      ...(config.privateKey ? { privateKey: config.privateKey } : {}),
    };

    return new Promise<SSHTunnel>((resolve, reject) => {
      let settled = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;

        try {
          sshClient.end();
        } catch {
          // Ignore cleanup errors.
        }

        reject(error);
      };

      sshClient.once("ready", () => {
        const server = net.createServer((socket) => {
          sshClient.forwardOut(
            socket.remoteAddress || localHost,
            socket.remotePort || 0,
            config.remoteHost,
            config.remotePort,
            (error: any, stream: any) => {
              if (error) {
                socket.destroy(error);
                return;
              }

              socket.pipe(stream);
              stream.pipe(socket);

              stream.on("error", () => socket.destroy());
              socket.on("error", () => stream.destroy());
            }
          );
        });

        server.once("error", (error: any) => {
          fail(error);
        });

        server.listen(localPort, localHost, () => {
          const address = server.address();

          if (!address || typeof address === "string") {
            fail(new Error("Unable to determine local SSH tunnel port."));
            return;
          }

          const tunnel: SSHTunnel = {
            connectionId,
            localHost,
            localPort: address.port,
            remoteHost: config.remoteHost,
            remotePort: config.remotePort,
            close: async () => {
              await this.closeTunnel(connectionId);
            },
          };

          const activeTunnelRecord: ActiveTunnel = {
            sshClient,
            server,
            tunnel,
            connectedAt: new Date(),
            isExplicitClose: false,
            config,
          };

          this.activeTunnels.set(connectionId, activeTunnelRecord);
          settled = true;

          // Wire up auto-reconnection on unexpected connection drop
          sshClient.on("close", () => {
            const current = this.activeTunnels.get(connectionId);
            if (current && !current.isExplicitClose) {
              console.warn(`[SSH Tunnel] Connection closed unexpectedly. Scheduling auto-reconnect in 5s...`);
              this.activeTunnels.delete(connectionId);
              try {
                current.server?.close();
              } catch {}

              const timer = setTimeout(() => {
                this.reconnectTimers.delete(connectionId);
                this.ensureDefaultTunnel().catch((reconnectErr) => {
                  console.warn("[SSH Tunnel] Auto-reconnect attempt failed:", reconnectErr?.message);
                });
              }, 5000);
              this.reconnectTimers.set(connectionId, timer);
            }
          });

          resolve(tunnel);
        });
      });

      sshClient.once("error", (error: any) => {
        this.lastErrors.set(connectionId, error?.message || String(error));
        fail(error);
      });

      sshClient.connect(connectConfig);
    });
  }

  /**
   * Get an existing tunnel.
   */
  getTunnel(connectionId: string): SSHTunnel | undefined {
    return this.activeTunnels.get(connectionId)?.tunnel;
  }

  /**
   * Check whether a tunnel exists.
   */
  isTunnelActive(connectionId = "default_mailwizz"): boolean {
    return this.activeTunnels.has(connectionId);
  }

  /**
   * Get real-time status of the default SSH server connection.
   */
  getStatus(connectionId = "default_mailwizz"): SSHTunnelStatus {
    const active = this.activeTunnels.get(connectionId);
    const config = active?.config || this.getDefaultConfig();
    const isConnecting = this.inFlightPromises.has(connectionId);
    const lastError = this.lastErrors.get(connectionId) || null;

    let uptimeSeconds: number | null = null;
    let connectedAt: string | null = null;

    if (active?.connectedAt) {
      connectedAt = active.connectedAt.toISOString();
      uptimeSeconds = Math.floor((Date.now() - active.connectedAt.getTime()) / 1000);
    }

    return {
      enabled: SSH_ENABLED,
      connected: !!active,
      connecting: isConnecting,
      connectionId,
      host: config.host,
      port: config.port ?? 22,
      username: config.username,
      localHost: "127.0.0.1",
      localPort: active?.tunnel.localPort ?? config.localPort ?? 3307,
      remoteHost: config.remoteHost,
      remotePort: config.remotePort,
      connectedAt,
      uptimeSeconds,
      lastError,
    };
  }

  /**
   * Close one tunnel.
   */
  async closeTunnel(connectionId: string): Promise<void> {
    const pendingTimer = this.reconnectTimers.get(connectionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.reconnectTimers.delete(connectionId);
    }

    const active = this.activeTunnels.get(connectionId);
    if (!active) {
      return;
    }

    active.isExplicitClose = true;
    this.activeTunnels.delete(connectionId);

    if (active.server) {
      await new Promise<void>((resolve) => {
        active.server?.close(() => resolve());
      }).catch(() => {});
    }

    if (active.sshClient) {
      try {
        active.sshClient.end();
      } catch {}
    }
  }

  /**
   * Disconnect default tunnel.
   */
  async disconnectDefaultTunnel(): Promise<void> {
    await this.closeTunnel("default_mailwizz");
  }

  /**
   * Close all active tunnels.
   */
  async closeAllTunnels(): Promise<void> {
    const connectionIds = Array.from(this.activeTunnels.keys());
    await Promise.all(connectionIds.map((id) => this.closeTunnel(id)));
  }

  /**
   * Find a free local TCP port.
   */
  private async findAvailablePort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);

      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          server.close();
          reject(new Error("Unable to find an available local TCP port."));
          return;
        }

        const port = address.port;
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(port);
        });
      });
    });
  }
}

export const sshTunnelService = new SSHTunnelService();