import { Response } from 'express';

import MailWizzConnection from '../models/MailWizzConnection';
import Mailbox from '../models/Mailbox';

import MailWizzClient from '../services/mailwizzClient';

import {
  syncDeliveryServers,
} from '../services/mailwizzSync.service';

import { AuthRequest } from '../middleware/auth';

/**
 * Create a MailWizz connection.
 */
export async function addConnection(
  req: AuthRequest,
  res: Response
) {
  const {
    name,
    base_url,
    api_key,
  } = req.body;

  if (
    !name ||
    !base_url ||
    !api_key
  ) {
    return res.status(400).json({
      error:
        'name, base_url and api_key are required',
    });
  }

  try {
    const connection =
      await MailWizzConnection.create({
        user_id: req.userId,

        name,

        base_url,

        api_key,

        status: 'disconnected',
      });

    return res.status(201).json({
      connection,
    });

  } catch (error: any) {

    /**
     * Duplicate user + base_url.
     */
    if (
      error?.code === 11000
    ) {
      return res.status(409).json({
        error:
          'A MailWizz connection with this URL already exists',
      });
    }

    return res.status(500).json({
      error: error.message,
    });
  }
}

/**
 * Test a MailWizz connection without
 * saving it to MongoDB.
 */
export async function testConnection(
  req: AuthRequest,
  res: Response
) {
  const {
    base_url,
    api_key,
  } = req.body;

  if (
    !base_url ||
    !api_key
  ) {
    return res.status(400).json({
      error:
        'base_url and api_key are required',
    });
  }

  try {
    const client =
      new MailWizzClient(
        base_url,
        api_key
      );

    const servers =
      await client.getDeliveryServers();

    return res.json({
      ok: true,

      delivery_server_count:
        servers.length,
    });

  } catch (error: any) {

    return res.status(400).json({
      ok: false,

      error:
        error.message,
    });
  }
}

/**
 * Synchronize MailWizz delivery servers
 * into our Mailbox collection.
 */
export async function syncNow(
  req: AuthRequest,
  res: Response
) {
  const {
    connectionId,
  } = req.params;

  try {

    const result =
      await syncDeliveryServers(
        connectionId,
        req.userId!
      );

    return res.json({
      ok: true,
      result,
    });

  } catch (error: any) {

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

/**
 * List synchronized mailboxes.
 */
export async function listMailboxes(
  req: AuthRequest,
  res: Response
) {
  try {

    const mailboxes =
      await Mailbox.find({
        user_id: req.userId,
      }).sort({
        email_address: 1,
      });

    return res.json({
      mailboxes,
    });

  } catch (error: any) {

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}