import mysql, {
  Pool,
  PoolConnection,
  RowDataPacket,
} from "mysql2/promise";
import { sshTunnelService } from "../services/sshTunnel.service";

/**
 * Database configuration for a MailWizz connection.
 *
 * The host/port will normally point to the LOCAL end
 * of the SSH tunnel.
 *
 * Example:
 * host: 127.0.0.1
 * port: 3307
 *
 * which forwards through SSH to:
 * remoteHost: 127.0.0.1
 * remotePort: 3306
 */
export interface MailwizzDbConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;

  /**
   * Optional SSH Server details per connection
   */
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshPassword?: string;

  /**
   * Optional pool size.
   * Defaults to 5.
   */
  poolSize?: number;
}

const requiredEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
};

/**
 * Ensures the SSH server connection is established before database operations.
 */
export const ensureMailwizzServerConnection = async (
  config?: MailwizzDbConnectionConfig
): Promise<void> => {
  if (config?.sshHost && config?.sshUser) {
    try {
      const connId = `conn_${config.sshHost}_${config.port || 3307}`;
      await sshTunnelService.ensureCustomTunnel(
        {
          host: config.sshHost,
          port: config.sshPort || 22,
          username: config.sshUser,
          password: config.sshPassword || "",
          remoteHost: "127.0.0.1",
          remotePort: 3306,
          localPort: config.port || 3307,
        },
        connId
      );
      return;
    } catch (err: any) {
      console.error("[MailWizz DB] Custom SSH server connection failed:", err?.message || err);
      throw new Error(`Server login connection failed: ${err?.message || err}`);
    }
  }

  const targetHost = config?.host || process.env.MAILWIZZ_DB_HOST || "127.0.0.1";
  const targetPort = Number(config?.port || process.env.MAILWIZZ_DB_PORT || 3307);

  // If connecting to local forwarded port (127.0.0.1 / localhost on port 3307 or configured SSH_LOCAL_PORT),
  // automatically ensure the SSH server tunnel is connected first.
  const isLocalForward =
    (targetHost === "127.0.0.1" || targetHost === "localhost") &&
    (targetPort === 3307 || targetPort === Number(process.env.SSH_LOCAL_PORT || 3307));

  if (isLocalForward) {
    try {
      await sshTunnelService.ensureDefaultTunnel();
    } catch (err: any) {
      console.error("[MailWizz DB] Automated server login connection failed:", err?.message || err);
      throw new Error(`Server login connection failed: ${err?.message || err}`);
    }
  }
};

/**
 * Default MailWizz configuration.
 */
const getDefaultMailwizzDbConfig = (): MailwizzDbConnectionConfig => {
  return {
    host: process.env.MAILWIZZ_DB_HOST || "127.0.0.1",
    port: Number(process.env.MAILWIZZ_DB_PORT || 3307),
    database: process.env.MAILWIZZ_DB_NAME || "mailwizz",
    user: process.env.MAILWIZZ_DB_USER || "mailwizzadmin",
    password: process.env.MAILWIZZ_DB_PASSWORD || "",
    poolSize: Number(process.env.MAILWIZZ_DB_POOL_SIZE || 5),
  };
};

/**
 * Create a MySQL/MariaDB pool for a specific
 * MailWizz database connection.
 */
export const createMailwizzDbPool = (
  config: MailwizzDbConnectionConfig
): Pool => {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: config.poolSize || 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: false,
  });
};

/**
 * Existing/default MailWizz pool.
 */
let defaultMailwizzDbPool: Pool | null = null;

export const getMailwizzDb = (
  config?: MailwizzDbConnectionConfig
): Pool => {
  if (config) {
    return createMailwizzDbPool(config);
  }
  if (!defaultMailwizzDbPool) {
    defaultMailwizzDbPool = createMailwizzDbPool(
      getDefaultMailwizzDbConfig()
    );
  }
  return defaultMailwizzDbPool;
};

/**
 * Get a connection from the default MailWizz pool.
 * Automatically guarantees server login connection is established first.
 */
export const getMailwizzDbConnection = async (
  config?: MailwizzDbConnectionConfig
): Promise<PoolConnection> => {
  await ensureMailwizzServerConnection(config);
  return getMailwizzDb(config).getConnection();
};

/**
 * Test the default or dynamically-created
 * MailWizz database pool.
 * Automatically guarantees server login connection is established first.
 */
export const testMailwizzDbConnection = async (
  poolOrConfig?: Pool | MailwizzDbConnectionConfig
): Promise<{
  connected: boolean;
  database: string | null;
  serverVersion: string | null;
  tablesCount?: number;
  tables?: string[];
}> => {
  let pool: Pool;
  let isTempPool = false;

  if (poolOrConfig && "host" in poolOrConfig) {
    await ensureMailwizzServerConnection(poolOrConfig);
    pool = createMailwizzDbPool(poolOrConfig);
    isTempPool = true;
  } else if (poolOrConfig) {
    pool = poolOrConfig as Pool;
  } else {
    await ensureMailwizzServerConnection();
    pool = getMailwizzDb();
  }

  try {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `
        SELECT
          DATABASE() AS database_name,
          VERSION() AS server_version
        `
      );

      const row = rows[0];

      let tablesCount = 0;
      let tables: string[] = [];
      try {
        const [tableRows] = await connection.query<RowDataPacket[]>(
          `
          SELECT TABLE_NAME AS tableName
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY TABLE_NAME
          `
        );
        tables = tableRows.map((r) => r.tableName as string);
        tablesCount = tables.length;
      } catch {
        // ignore table discovery failure
      }

      return {
        connected: true,
        database: row?.database_name ?? null,
        serverVersion: row?.server_version ?? null,
        tablesCount,
        tables,
      };
    } finally {
      connection.release();
    }
  } finally {
    if (isTempPool) {
      await pool.end().catch(() => {});
    }
  }
};

/**
 * Get all databases visible to the
 * current database user.
 * Automatically guarantees server login connection is established first.
 */
export const getAvailableDatabases = async (
  poolOrConfig?: Pool | MailwizzDbConnectionConfig
): Promise<string[]> => {
  let pool: Pool;
  let isTemp = false;
  if (poolOrConfig && "host" in poolOrConfig) {
    await ensureMailwizzServerConnection(poolOrConfig);
    pool = createMailwizzDbPool(poolOrConfig);
    isTemp = true;
  } else if (poolOrConfig) {
    pool = poolOrConfig as Pool;
  } else {
    await ensureMailwizzServerConnection();
    pool = getMailwizzDb();
  }

  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SHOW DATABASES"
    );

    return rows.map((row) => row.Database as string);
  } finally {
    connection.release();
    if (isTemp) {
      await pool.end().catch(() => {});
    }
  }
};

/**
 * Close the default MailWizz pool.
 */
export const closeMailwizzDb = async (): Promise<void> => {
  if (defaultMailwizzDbPool) {
    await defaultMailwizzDbPool.end();
    defaultMailwizzDbPool = null;
  }
};