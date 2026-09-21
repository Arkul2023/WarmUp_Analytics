import { Request, Response } from "express";
import { mailwizzDbService } from "../services/mailwizzDB.service";
import { MailwizzDbConnectionConfig } from "../config/mailwizzDB";
import { sshTunnelService } from "../services/sshTunnel.service";
import MailWizzConnection from "../models/MailWizzConnection";

function parseConfigFromReq(
  req: Request
): MailwizzDbConnectionConfig | undefined {
  const source =
    req.method === "POST" ? req.body : req.query;

  if (!source || typeof source !== "object") {
    return undefined;
  }

  const {
    host,
    port,
    database,
    user,
    password,
    sshHost,
    ssh_host,
    sshPort,
    ssh_port,
    sshUser,
    ssh_user,
    sshPassword,
    ssh_password,
  } = source as Record<string, any>;

  if (!host && !database && !user && !sshHost && !ssh_host) {
    return undefined;
  }

  return {
    host: String(host || process.env.MAILWIZZ_DB_HOST || "127.0.0.1"),
    port: Number(port || process.env.MAILWIZZ_DB_PORT || 3307),
    database: String(database || process.env.MAILWIZZ_DB_NAME || "mailwizz"),
    user: String(user || process.env.MAILWIZZ_DB_USER || "mailwizzadmin"),
    password: String(password ?? process.env.MAILWIZZ_DB_PASSWORD ?? ""),
    sshHost: sshHost || ssh_host ? String(sshHost || ssh_host) : undefined,
    sshPort: sshPort || ssh_port ? Number(sshPort || ssh_port) : undefined,
    sshUser: sshUser || ssh_user ? String(sshUser || ssh_user) : undefined,
    sshPassword: sshPassword || ssh_password ? String(sshPassword || ssh_password) : undefined,
  };
}

class MailwizzDbController {
  /**
   * GET /api/mailwizz/db/connections
   */
  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      let connections: any[] = [];
      try {
        connections = await MailWizzConnection.find().lean();
      } catch (dbErr) {
        // Fallback if Mongo unavailable
      }

      if (!connections || connections.length === 0) {
        const defaultConn = {
          _id: "default_conn_1",
          name: "MailWizz Connection #1",
          ssh_host: process.env.SSH_HOST || "15.235.163.118",
          ssh_port: Number(process.env.SSH_PORT || 22),
          ssh_user: process.env.SSH_USER || "ubuntu",
          ssh_password: process.env.SSH_PASSWORD || "Warje@130779",
          host: process.env.MAILWIZZ_DB_HOST || "127.0.0.1",
          port: Number(process.env.MAILWIZZ_DB_PORT || 3307),
          database: process.env.MAILWIZZ_DB_NAME || "mailwizz",
          user: process.env.MAILWIZZ_DB_USER || "mailwizzadmin",
          password: process.env.MAILWIZZ_DB_PASSWORD || "Wakad@54321",
          status: "connected",
        };
        connections = [defaultConn];
      }

      res.status(200).json({
        success: true,
        data: connections,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || "Failed to fetch connections",
      });
    }
  }

  /**
   * POST /api/mailwizz/db/connections
   */
  async saveConnection(req: Request, res: Response): Promise<void> {
    try {
      const {
        id,
        _id,
        name,
        ssh_host,
        sshHost,
        ssh_port,
        sshPort,
        ssh_user,
        sshUser,
        ssh_password,
        sshPassword,
        host,
        port,
        database,
        user,
        password,
        status,
      } = req.body;

      const connId = id || _id;
      const dataToSave = {
        name: name || "MailWizz Connection",
        ssh_host: ssh_host || sshHost || "15.235.163.118",
        ssh_port: Number(ssh_port || sshPort || 22),
        ssh_user: ssh_user || sshUser || "ubuntu",
        ssh_password: ssh_password ?? sshPassword ?? "",
        host: host || "127.0.0.1",
        port: Number(port || 3307),
        database: database || "mailwizz",
        user: user || "mailwizzadmin",
        password: password ?? "",
        status: status || "connected",
      };

      let record;
      try {
        if (connId && connId !== "default_conn_1" && String(connId).length === 24) {
          record = await MailWizzConnection.findByIdAndUpdate(connId, dataToSave, { new: true, upsert: true });
        } else {
          record = await MailWizzConnection.create(dataToSave);
        }
      } catch (err) {
        record = { _id: connId || `conn_${Date.now()}`, ...dataToSave };
      }

      res.status(200).json({
        success: true,
        data: record,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || "Failed to save connection",
      });
    }
  }

  /**
   * DELETE /api/mailwizz/db/connections/:id
   */
  async deleteConnection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (id && id !== "default_conn_1" && String(id).length === 24) {
        try {
          await MailWizzConnection.findByIdAndDelete(id);
        } catch {}
      }
      res.status(200).json({
        success: true,
        message: "Connection deleted successfully",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || "Failed to delete connection",
      });
    }
  }

  /**
   * POST or GET /api/mailwizz/db/test
   */
  async testConnection(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const config = parseConfigFromReq(req);
      const result = await mailwizzDbService.testConnection(config);

      res.status(200).json({
        success: true,
        message: "MailWizz database connection successful",
        data: result,
      });
    } catch (error: any) {
      console.error(
        "MailWizz DB connection failed:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error?.message ||
          "MailWizz database connection failed",
        error: error?.message,
      });
    }
  }

  /**
   * POST or GET /api/mailwizz/db/sync
   */
  async syncPlatformData(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const config = parseConfigFromReq(req);
      const result = await mailwizzDbService.syncPlatformData(config);

      res.status(200).json({
        success: true,
        message: "MailWizz platform data synchronized successfully",
        data: result,
      });
    } catch (error: any) {
      console.error(
        "MailWizz DB sync failed:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error?.message ||
          "MailWizz database sync failed",
        error: error?.message,
      });
    }
  }

  async getDatabases(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const config = parseConfigFromReq(req);
      const databases =
        await mailwizzDbService.getDatabases(config);

      res.status(200).json({
        success: true,
        count: databases.length,
        data: databases,
      });
    } catch (error: any) {
      console.error(
        "Failed to read MariaDB databases:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          "Failed to read MariaDB databases",
        error: error?.message,
      });
    }
  }

  /**
   * GET /api/mailwizz/db/tables
   */
  async getTables(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const config = parseConfigFromReq(req);
      const tables = await mailwizzDbService.getTables(config);

      res.status(200).json({
        success: true,
        count: tables.length,
        data: tables,
      });
    } catch (error: any) {
      console.error(
        "Failed to read MailWizz tables:",
        error
      );

      res.status(400).json({
        success: false,
        message: "Failed to read MailWizz database tables",
        error: error?.message,
      });
    }
  }

  /**
   * GET /api/mailwizz/db/tables/:tableName/columns
   */
  async getTableColumns(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { tableName } = req.params;
      const config = parseConfigFromReq(req);

      const columns =
        await mailwizzDbService.getTableColumns(
          tableName,
          config
        );

      res.status(200).json({
        success: true,
        tableName,
        count: columns.length,
        data: columns,
      });
    } catch (error: any) {
      console.error(
        "Failed to read MailWizz table columns:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          "Failed to read MailWizz table columns",
        error: error?.message,
      });
    }
  }

  /**
   * GET or POST /api/mailwizz/db/delivery-servers
   */
  async getDeliveryServers(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const config = parseConfigFromReq(req);
      const servers = await mailwizzDbService.getDeliveryServers(config);

      res.status(200).json({
        success: true,
        count: servers.length,
        data: servers,
      });
    } catch (error: any) {
      console.error("Failed to fetch MailWizz delivery servers:", error);

      res.status(400).json({
        success: false,
        message:
          error?.message || "Failed to fetch MailWizz delivery servers",
        error: error?.message,
      });
    }
  }

  /**
   * GET or POST /api/mailwizz/db/workspace-accounts
   */
  async getWorkspaceAccounts(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const config = parseConfigFromReq(req);
      const accounts = await mailwizzDbService.getWorkspaceAccounts(config);

      res.status(200).json({
        success: true,
        count: accounts.length,
        data: accounts,
      });
    } catch (error: any) {
      console.error("Failed to fetch MailWizz workspace accounts:", error);

      res.status(400).json({
        success: false,
        message:
          error?.message || "Failed to fetch MailWizz workspace accounts",
        error: error?.message,
      });
    }
  }

  /**
   * GET or POST /api/mailwizz/db/seed-accounts
   */
  async getSeedAccounts(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const config = parseConfigFromReq(req);
      const accounts = await mailwizzDbService.getSeedAccounts(config);

      res.status(200).json({
        success: true,
        count: accounts.length,
        data: accounts,
      });
    } catch (error: any) {
      console.error("Failed to fetch MailWizz seed accounts:", error);

      res.status(400).json({
        success: false,
        message:
          error?.message || "Failed to fetch MailWizz seed accounts",
        error: error?.message,
      });
    }
  }

  /**
   * GET /api/mailwizz/db/server/status
   */
  async getServerStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = sshTunnelService.getStatus();
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error?.message || "Failed to retrieve server status",
        error: error?.message,
      });
    }
  }

  /**
   * POST /api/mailwizz/db/server/connect
   */
  async connectServer(req: Request, res: Response): Promise<void> {
    try {
      const forceReconnect = req.body?.forceReconnect === true;
      const tunnel = await sshTunnelService.ensureDefaultTunnel(forceReconnect);
      const status = sshTunnelService.getStatus();

      res.status(200).json({
        success: true,
        message: "Server login connection established successfully",
        data: {
          tunnel,
          status,
        },
      });
    } catch (error: any) {
      console.error("Server connection failed:", error);
      res.status(400).json({
        success: false,
        message: error?.message || "Server connection failed",
        error: error?.message,
      });
    }
  }

  /**
   * POST /api/mailwizz/db/server/disconnect
   */
  async disconnectServer(req: Request, res: Response): Promise<void> {
    try {
      await sshTunnelService.disconnectDefaultTunnel();
      res.status(200).json({
        success: true,
        message: "Server disconnected successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error?.message || "Failed to disconnect server",
        error: error?.message,
      });
    }
  }
}

export const mailwizzDbController =
  new MailwizzDbController();

