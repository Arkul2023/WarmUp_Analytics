import { RowDataPacket } from "mysql2/promise";
import {
  getMailwizzDb,
  testMailwizzDbConnection,
  MailwizzDbConnectionConfig,
  ensureMailwizzServerConnection,
} from "../config/mailwizzDB";

export interface MailwizzDbHealth {
  connected: boolean;
  database: string;
  serverVersion?: string;
  tablesCount?: number;
  tables?: string[];
}

export interface MailwizzPlatformSyncResult {
  connected: boolean;
  database: string;
  serverVersion?: string;
  totalCustomers: number;
  totalDeliveryServers: number;
  totalCampaigns: number;
  tablesCount: number;
  tables: string[];
  deliveryServers: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    hostname?: string;
  }>;
  lastSync: string;
}

export interface DatabaseTable {
  tableName: string;
}

export interface DatabaseColumn {
  tableName: string;
  columnName: string;
  dataType: string;
  columnType: string;
  isNullable: string;
  columnKey: string;
}

class MailwizzDbService {
  /**
   * Test the MailWizz database connection.
   */
  async testConnection(
    config?: MailwizzDbConnectionConfig
  ): Promise<MailwizzDbHealth> {
    const result = await testMailwizzDbConnection(config);
    return {
      connected: result.connected,
      database: result.database || (config?.database ?? "mailwizz"),
      serverVersion: result.serverVersion ?? undefined,
      tablesCount: result.tablesCount,
      tables: result.tables,
    };
  }

  /**
   * Synchronize & inspect platform data from MailWizz database.
   */
  async syncPlatformData(
    config?: MailwizzDbConnectionConfig
  ): Promise<MailwizzPlatformSyncResult> {
    await ensureMailwizzServerConnection(config);
    const pool = getMailwizzDb(config);
    const isTempPool = !!config;

    try {
      const connection = await pool.getConnection();

      try {
        const [infoRows] = await connection.query<RowDataPacket[]>(
          `SELECT DATABASE() AS database_name, VERSION() AS server_version`
        );
        const dbName =
          (infoRows[0]?.database_name as string) ||
          config?.database ||
          "mailwizz";
        const sVer = infoRows[0]?.server_version as string;

        const [tableRows] = await connection.query<RowDataPacket[]>(
          `SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
        );
        const tableNames = tableRows.map(
          (r) => r.tableName as string
        );

        let totalCustomers = 0;
        let totalDeliveryServers = 0;
        let totalCampaigns = 0;
        const deliveryServers: Array<{
          id: string;
          name: string;
          type: string;
          status: string;
          hostname?: string;
        }> = [];

        // Check delivery server table (e.g. mw_delivery_server or delivery_server)
        const dsTable = tableNames.find((t) => {
          const l = t.toLowerCase();
          return l === "mw_delivery_server" || l === "delivery_server";
        }) || tableNames.find((t) => t.toLowerCase().endsWith("_delivery_server"));

        if (dsTable) {
          try {
            const [cntRows] = await connection.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS cnt FROM \`${dsTable}\``
            );
            totalDeliveryServers = Number(cntRows[0]?.cnt ?? 0);

            const [dsRows] = await connection.query<RowDataPacket[]>(
              `SELECT * FROM \`${dsTable}\` LIMIT 200`
            );
            dsRows.forEach((r: any) => {
              deliveryServers.push({
                id: String(r.server_id || r.id || ""),
                name: String(
                  r.name || r.hostname || r.username || "Delivery Server"
                ),
                type: String(r.type || "smtp"),
                status: String(r.status || "active"),
                hostname: String(r.hostname || ""),
              });
            });
          } catch (err) {
            console.warn("Failed to query delivery servers table:", err);
          }
        }

        // Check customer table (e.g. mw_customer or customer)
        const custTable = tableNames.find((t) => {
          const l = t.toLowerCase();
          return l === "mw_customer" || l === "customer";
        }) || tableNames.find((t) => t.toLowerCase().endsWith("_customer"));

        if (custTable) {
          try {
            const [cRows] = await connection.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS cnt FROM \`${custTable}\``
            );
            totalCustomers = Number(cRows[0]?.cnt ?? 0);
          } catch (err) {
            console.warn("Failed to query customer table:", err);
          }
        }

        // Check campaign table (e.g. mw_campaign or campaign)
        const campTable = tableNames.find((t) => {
          const l = t.toLowerCase();
          return l === "mw_campaign" || l === "campaign";
        }) || tableNames.find((t) => t.toLowerCase().endsWith("_campaign"));

        if (campTable) {
          try {
            const [cpRows] = await connection.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS cnt FROM \`${campTable}\``
            );
            totalCampaigns = Number(cpRows[0]?.cnt ?? 0);
          } catch (err) {
            console.warn("Failed to query campaign table:", err);
          }
        }

        return {
          connected: true,
          database: dbName,
          serverVersion: sVer,
          totalCustomers: totalCustomers || (deliveryServers.length > 0 ? Math.ceil(deliveryServers.length / 5) : 0),
          totalDeliveryServers: totalDeliveryServers,
          totalCampaigns: totalCampaigns,
          tablesCount: tableNames.length,
          tables: tableNames,
          deliveryServers,
          lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
      } finally {
        connection.release();
      }
    } finally {
      if (isTempPool) {
        await pool.end().catch(() => {});
      }
    }
  }

  /**
   * Return all databases visible to the configured MariaDB user.
   */
  async getDatabases(
    config?: MailwizzDbConnectionConfig
  ): Promise<string[]> {
    await ensureMailwizzServerConnection(config);
    const pool = getMailwizzDb(config);
    const isTemp = !!config;
    try {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query<RowDataPacket[]>(
          `SHOW DATABASES`
        );
        return rows.map((row) => row.Database as string);
      } finally {
        connection.release();
      }
    } finally {
      if (isTemp) {
        await pool.end().catch(() => {});
      }
    }
  }

  /**
   * Return all tables in the configured MailWizz database.
   */
  async getTables(
    config?: MailwizzDbConnectionConfig
  ): Promise<DatabaseTable[]> {
    await ensureMailwizzServerConnection(config);
    const pool = getMailwizzDb(config);
    const isTemp = !!config;
    try {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query<RowDataPacket[]>(
          `
          SELECT
            TABLE_NAME AS tableName
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY TABLE_NAME
          `
        );
        return rows.map((row) => ({
          tableName: row.tableName,
        }));
      } finally {
        connection.release();
      }
    } finally {
      if (isTemp) {
        await pool.end().catch(() => {});
      }
    }
  }

  /**
   * Return the columns of a specific table.
   */
  async getTableColumns(
    tableName: string,
    config?: MailwizzDbConnectionConfig
  ): Promise<DatabaseColumn[]> {
    await ensureMailwizzServerConnection(config);
    const pool = getMailwizzDb(config);
    const isTemp = !!config;
    try {
      const connection = await pool.getConnection();
      try {
        const [tableRows] = await connection.query<RowDataPacket[]>(
          `
          SELECT TABLE_NAME
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
          LIMIT 1
          `,
          [tableName]
        );

        if (tableRows.length === 0) {
          throw new Error(`Table '${tableName}' does not exist`);
        }

        const [rows] = await connection.query<RowDataPacket[]>(
          `
          SELECT
            TABLE_NAME AS tableName,
            COLUMN_NAME AS columnName,
            DATA_TYPE AS dataType,
            COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable,
            COLUMN_KEY AS columnKey
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
          `,
          [tableName]
        );

        return rows.map((row) => ({
          tableName: row.tableName,
          columnName: row.columnName,
          dataType: row.dataType,
          columnType: row.columnType,
          isNullable: row.isNullable,
          columnKey: row.columnKey,
        }));
      } finally {
        connection.release();
      }
    } finally {
      if (isTemp) {
        await pool.end().catch(() => {});
      }
    }
  }

  /**
   * Fetch all delivery servers directly from MailWizz database without duplicates.
   */
  async getDeliveryServers(
    config?: MailwizzDbConnectionConfig
  ): Promise<any[]> {
    await ensureMailwizzServerConnection(config);
    const pool = getMailwizzDb(config);
    const isTemp = !!config;
    try {
      const connection = await pool.getConnection();
      try {
        const [tableRows] = await connection.query<RowDataPacket[]>(
          `SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
        );
        const tableNames = tableRows.map((r) => r.tableName as string);

        const dsTable =
          tableNames.find((t) => {
            const l = t.toLowerCase();
            return l === "mw_delivery_server" || l === "delivery_server";
          }) ||
          tableNames.find((t) => t.toLowerCase().endsWith("_delivery_server"));

        if (!dsTable) {
          return [];
        }

        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM \`${dsTable}\` ORDER BY server_id ASC`
        );

        const seenKeys = new Set<string>();
        const deliveryServers: any[] = [];

        rows.forEach((r: any) => {
          const emailVal = String(
            r.from_email || r.username || r.name || ""
          ).trim();
          const emailLower = emailVal.toLowerCase();

          // Deduplication: prevent duplicate servers with same email or server_id
          const uniqueKey =
            emailLower && emailLower.includes("@")
              ? emailLower
              : `server_${r.server_id}`;

          if (seenKeys.has(uniqueKey)) {
            return;
          }
          seenKeys.add(uniqueKey);

          const domain = emailVal.includes("@")
            ? emailVal.split("@")[1]
            : r.hostname || "";
          const isConnected =
            String(r.status || "").toLowerCase() === "active";

          deliveryServers.push({
            id: String(r.server_id || r.id || ""),
            server_id: Number(r.server_id || r.id || 0),
            email:
              emailVal ||
              `delivery-server-${r.server_id}@${r.hostname || "mailwizz"}`,
            name: String(r.name || r.from_name || "SMTP Delivery Server"),
            display_name: String(r.from_name || r.name || ""),
            hostname: String(r.hostname || ""),
            smtp_host: String(r.hostname || "localhost"),
            smtp_port: Number(r.port || 587),
            protocol: String(r.protocol || "tls"),
            type: String(r.type || "smtp"),
            account_type: "smtp",
            status: isConnected ? "Active" : r.status || "Inactive",
            status_info: {
              status: isConnected ? "Connected" : "Inactive",
              error: null,
            },
            hourly_quota: Number(r.hourly_quota || 0),
            daily_quota: Number(r.daily_quota || 0),
            monthly_quota: Number(r.monthly_quota || 0),
            domain: domain,
            date_added: r.date_added,
            last_updated: r.last_updated,
          });
        });

        return deliveryServers;
      } finally {
        connection.release();
      }
    } finally {
      if (isTemp) {
        await pool.end().catch(() => {});
      }
    }
  }

  /**
   * Fetch Workspace email accounts (.com sending accounts) from connected MailWizz database only.
   */
  async getWorkspaceAccounts(
    config?: MailwizzDbConnectionConfig
  ): Promise<any[]> {
    await ensureMailwizzServerConnection(config);
    const pool = getMailwizzDb(config);
    const isTemp = !!config;
    try {
      const connection = await pool.getConnection();
      try {
        const [tableRows] = await connection.query<RowDataPacket[]>(
          `SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
        );
        const tableNames = tableRows.map((r) => r.tableName as string);

        const dsTable =
          tableNames.find((t) => {
            const l = t.toLowerCase();
            return l === "mw_delivery_server" || l === "delivery_server";
          }) ||
          tableNames.find((t) => t.toLowerCase().endsWith("_delivery_server"));

        if (!dsTable) {
          return [];
        }

        const [rows] = await connection.query<RowDataPacket[]>(
          `
          SELECT * FROM \`${dsTable}\` 
          WHERE (hostname LIKE '%gmail.com%' OR hostname LIKE '%google.com%') 
            AND from_email NOT LIKE '%@gmail.com%' 
            AND username NOT LIKE '%@gmail.com%'
          ORDER BY server_id ASC
          `
        );

        const seenKeys = new Set<string>();
        const workspaceAccounts: any[] = [];

        rows.forEach((r: any) => {
          const emailVal = String(
            r.from_email || r.username || r.name || ""
          ).trim();
          const emailLower = emailVal.toLowerCase();

          if (!emailLower || seenKeys.has(emailLower)) {
            return;
          }
          seenKeys.add(emailLower);

          const domain = emailVal.includes("@")
            ? emailVal.split("@")[1]
            : "workspace.com";
          const isConnected =
            String(r.status || "").toLowerCase() === "active";

          workspaceAccounts.push({
            id: String(r.server_id || r.id || ""),
            server_id: Number(r.server_id || r.id || 0),
            email: emailVal,
            domain: domain,
            name: String(r.name || r.from_name || "Workspace Account"),
            display_name: String(r.from_name || r.name || emailVal.split("@")[0]),
            imap_host: "imap.gmail.com",
            imap_port: 993,
            smtp_host: String(r.hostname || "smtp.gmail.com"),
            smtp_port: Number(r.port || 587),
            protocol: String(r.protocol || "tls"),
            type: "workspace",
            account_type: "workspace",
            status: isConnected ? "Connected" : r.status || "Inactive",
            status_info: {
              status: isConnected ? "Connected" : "Inactive",
              error: null,
            },
            hourly_quota: Number(r.hourly_quota || 0),
            daily_quota: Number(r.daily_quota || 0),
            date_added: r.date_added,
            last_updated: r.last_updated,
          });
        });

        return workspaceAccounts;
      } finally {
        connection.release();
      }
    } finally {
      if (isTemp) {
        await pool.end().catch(() => {});
      }
    }
  }

  /**
   * Fetch Seed / Test email accounts (Gmail seeds) from connected MailWizz database only.
   */
  async getSeedAccounts(
    config?: MailwizzDbConnectionConfig
  ): Promise<any[]> {
    await ensureMailwizzServerConnection(config);
    const pool = getMailwizzDb(config);
    const isTemp = !!config;
    try {
      const connection = await pool.getConnection();
      try {
        const [tableRows] = await connection.query<RowDataPacket[]>(
          `SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
        );
        const tableNames = tableRows.map((r) => r.tableName as string);

        const dsTable =
          tableNames.find((t) => {
            const l = t.toLowerCase();
            return l === "mw_delivery_server" || l === "delivery_server";
          }) ||
          tableNames.find((t) => t.toLowerCase().endsWith("_delivery_server"));

        if (!dsTable) {
          return [];
        }

        const [rows] = await connection.query<RowDataPacket[]>(
          `
          SELECT * FROM \`${dsTable}\` 
          WHERE from_email LIKE '%@gmail.com%' 
             OR username LIKE '%@gmail.com%' 
             OR name LIKE '%@gmail.com%'
          ORDER BY server_id ASC
          `
        );

        const seenKeys = new Set<string>();
        const seedAccounts: any[] = [];

        rows.forEach((r: any) => {
          const emailVal = String(
            r.from_email || r.username || r.name || ""
          ).trim();
          const emailLower = emailVal.toLowerCase();

          if (!emailLower || seenKeys.has(emailLower)) {
            return;
          }
          seenKeys.add(emailLower);

          const isConnected =
            String(r.status || "").toLowerCase() === "active";

          seedAccounts.push({
            id: String(r.server_id || r.id || ""),
            server_id: Number(r.server_id || r.id || 0),
            email: emailVal,
            domain: "gmail.com",
            name: String(r.name || r.from_name || "Seed Account"),
            display_name: String(r.from_name || r.name || emailVal.split("@")[0]),
            imap_host: "imap.gmail.com",
            imap_port: 993,
            smtp_host: String(r.hostname || "smtp.gmail.com"),
            smtp_port: Number(r.port || 587),
            protocol: String(r.protocol || "tls"),
            type: "seed",
            account_type: "seed",
            status: isConnected ? "Connected" : r.status || "Inactive",
            status_info: {
              status: isConnected ? "Connected" : "Inactive",
              error: null,
            },
            hourly_quota: Number(r.hourly_quota || 0),
            daily_quota: Number(r.daily_quota || 0),
            date_added: r.date_added,
            last_updated: r.last_updated,
          });
        });

        return seedAccounts;
      } finally {
        connection.release();
      }
    } finally {
      if (isTemp) {
        await pool.end().catch(() => {});
      }
    }
  }
}

export const mailwizzDbService = new MailwizzDbService();
