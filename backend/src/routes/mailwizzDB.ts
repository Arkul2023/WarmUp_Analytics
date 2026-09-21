import { Router } from "express";
import { mailwizzDbController } from "../controllers/mailwizzDBController";

const router = Router();

/**
 * Connection management
 */
router.get(
  "/connections",
  mailwizzDbController.getConnections.bind(mailwizzDbController)
);

router.post(
  "/connections",
  mailwizzDbController.saveConnection.bind(mailwizzDbController)
);

router.delete(
  "/connections/:id",
  mailwizzDbController.deleteConnection.bind(mailwizzDbController)
);

/**
 * Server login / SSH Tunnel status and management
 */
router.get(
  "/server/status",
  mailwizzDbController.getServerStatus.bind(mailwizzDbController)
);

router.post(
  "/server/connect",
  mailwizzDbController.connectServer.bind(mailwizzDbController)
);

router.post(
  "/server/disconnect",
  mailwizzDbController.disconnectServer.bind(mailwizzDbController)
);

/**
 * Test database connection
 */
router.get(
  "/test",
  mailwizzDbController.testConnection.bind(
    mailwizzDbController
  )
);

router.post(
  "/test",
  mailwizzDbController.testConnection.bind(
    mailwizzDbController
  )
);

/**
 * Synchronize and inspect platform data
 */
router.get(
  "/sync",
  mailwizzDbController.syncPlatformData.bind(
    mailwizzDbController
  )
);

router.post(
  "/sync",
  mailwizzDbController.syncPlatformData.bind(
    mailwizzDbController
  )
);

router.get(
  "/databases",
  mailwizzDbController.getDatabases.bind(
    mailwizzDbController
  )
);

/**
 * Discover MailWizz tables.
 */
router.get(
  "/tables",
  mailwizzDbController.getTables.bind(
    mailwizzDbController
  )
);

router.post(
  "/tables",
  mailwizzDbController.getTables.bind(
    mailwizzDbController
  )
);

/**
 * Discover columns for a MailWizz table.
 */
router.get(
  "/tables/:tableName/columns",
  mailwizzDbController.getTableColumns.bind(
    mailwizzDbController
  )
);

/**
 * Fetch MailWizz SMTP delivery servers
 */
router.get(
  "/delivery-servers",
  mailwizzDbController.getDeliveryServers.bind(
    mailwizzDbController
  )
);

router.post(
  "/delivery-servers",
  mailwizzDbController.getDeliveryServers.bind(
    mailwizzDbController
  )
);

/**
 * Fetch MailWizz Workspace email accounts
 */
router.get(
  "/workspace-accounts",
  mailwizzDbController.getWorkspaceAccounts.bind(
    mailwizzDbController
  )
);

router.post(
  "/workspace-accounts",
  mailwizzDbController.getWorkspaceAccounts.bind(
    mailwizzDbController
  )
);

/**
 * Fetch MailWizz Seed / Test email accounts
 */
router.get(
  "/seed-accounts",
  mailwizzDbController.getSeedAccounts.bind(
    mailwizzDbController
  )
);

router.post(
  "/seed-accounts",
  mailwizzDbController.getSeedAccounts.bind(
    mailwizzDbController
  )
);

export default router;