import mongoose from 'mongoose';

import MailWizzConnection from '../models/MailWizzConnection';
import Mailbox from '../models/Mailbox';

import MailWizzClient, {
  DeliveryServerRaw,
} from './mailwizzClient';

interface SyncResult {
  connection_id: string;
  created: number;
  updated: number;
  dropped: number;
  total_from_mailwizz: number;
  total_active: number;
  total_dropped: number;
}

/**
 * Extract domain from an email address.
 */
function extractDomain(
  email: string
): string {
  const normalizedEmail =
    email.trim().toLowerCase();

  const atIndex =
    normalizedEmail.lastIndexOf('@');

  if (atIndex === -1) {
    return '';
  }

  return normalizedEmail.substring(
    atIndex + 1
  );
}

/**
 * Extract and normalize email address
 * returned by MailWizz.
 */
function extractEmail(
  server: DeliveryServerRaw
): string {
  return String(
    server.name ?? ''
  )
    .trim()
    .toLowerCase();
}

/**
 * Extract MailWizz delivery-server ID.
 */
function extractDeliveryServerId(
  server: DeliveryServerRaw
): string {
  return String(
    server.server_id ?? ''
  ).trim();
}

/**
 * Synchronize MailWizz delivery servers
 * into our Mailbox collection.
 */
export async function syncDeliveryServers(
  connectionId: string,
  userId: string
): Promise<SyncResult> {

  if (
    !mongoose.Types.ObjectId.isValid(
      userId
    )
  ) {
    throw new Error(
      'Invalid user ID'
    );
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      connectionId
    )
  ) {
    throw new Error(
      'Invalid MailWizz connection ID'
    );
  }

  /**
   * Load the connection belonging to
   * this user.
   *
   * +api_key is required because api_key
   * is select:false in the model.
   */
  const connection =
    await MailWizzConnection.findOne({
      _id: connectionId,
      user_id: userId,
    }).select('+api_key');

  if (!connection) {
    throw new Error(
      'MailWizz connection not found'
    );
  }

  /**
   * Create MailWizz client.
   */
  const client =
    new MailWizzClient(
      connection.base_url,
      connection.api_key
    );

  /**
   * Fetch current delivery servers.
   */
  const deliveryServers =
    await client.getDeliveryServers();

  const now = new Date();

  /**
   * IDs currently returned by MailWizz.
   */
  const mailwizzDeliveryServerIds =
    new Set<string>();

  let created = 0;
  let updated = 0;

  /**
   * Synchronize each MailWizz
   * delivery server.
   */
  for (
    const server of deliveryServers
  ) {
    const deliveryServerId =
      extractDeliveryServerId(
        server
      );

    /**
     * Ignore malformed records.
     */
    if (!deliveryServerId) {
      continue;
    }

    mailwizzDeliveryServerIds.add(
      deliveryServerId
    );

    const emailAddress =
      extractEmail(server);

    /**
     * Our Mailbox model requires
     * an email address.
     */
    if (!emailAddress) {
      continue;
    }

    const domain =
      extractDomain(
        emailAddress
      );

    /**
     * Find existing mailbox.
     */
    const existingMailbox =
      await Mailbox.findOne({
        user_id: userId,

        mailwizz_connection_id:
          connection._id,

        mailwizz_delivery_server_id:
          deliveryServerId,
      });

    if (existingMailbox) {

      /**
       * Update MailWizz-owned fields.
       *
       * DO NOT reset warmup history.
       */
      existingMailbox.email_address =
        emailAddress;

      existingMailbox.domain =
        domain;

      /**
       * If previously dropped but now
       * returned by MailWizz, reactivate.
       */
      if (
        existingMailbox.status ===
        'dropped'
      ) {
        existingMailbox.status =
          'active';

        existingMailbox.dropped_at =
          undefined;
      }

      existingMailbox.last_synced_at =
        now;

      await existingMailbox.save();

      updated++;

      continue;
    }

    /**
     * Create new mailbox.
     */
    await Mailbox.create({
      user_id: userId,

      mailwizz_connection_id:
        connection._id,

      mailwizz_delivery_server_id:
        deliveryServerId,

      email_address:
        emailAddress,

      domain,

      /**
       * We will determine the exact
       * Workspace/SMTP mapping after
       * seeing the real MailWizz response.
       */
      type: 'other',

      status: 'active',

      first_synced_at: now,

      last_synced_at: now,
    });

    created++;
  }

  /**
   * Find all mailboxes previously
   * synchronized from this connection.
   */
  const existingMailboxes =
    await Mailbox.find({
      user_id: userId,

      mailwizz_connection_id:
        connection._id,
    });

  let dropped = 0;

  /**
   * Anything previously known but no
   * longer returned by MailWizz becomes
   * dropped.
   *
   * We NEVER delete the mailbox.
   */
  for (
    const mailbox of existingMailboxes
  ) {
    const deliveryServerId =
      mailbox.mailwizz_delivery_server_id;

    if (
      !mailwizzDeliveryServerIds.has(
        deliveryServerId
      )
    ) {
      if (
        mailbox.status !==
        'dropped'
      ) {
        mailbox.status =
          'dropped';

        mailbox.dropped_at =
          now;

        await mailbox.save();

        dropped++;
      }
    }
  }

  /**
   * Update connection state.
   */
  connection.last_sync_at =
    now;

  connection.status =
    'connected';

  connection.last_error =
    undefined;

  await connection.save();

  /**
   * Final counts.
   */
  const totalActive =
    await Mailbox.countDocuments({
      user_id: userId,

      mailwizz_connection_id:
        connection._id,

      status: 'active',
    });

  const totalDropped =
    await Mailbox.countDocuments({
      user_id: userId,

      mailwizz_connection_id:
        connection._id,

      status: 'dropped',
    });

  return {
    connection_id:
      connection._id.toString(),

    created,

    updated,

    dropped,

    total_from_mailwizz:
      deliveryServers.length,

    total_active:
      totalActive,

    total_dropped:
      totalDropped,
  };
}