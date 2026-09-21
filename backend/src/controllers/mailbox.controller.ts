import { Request, Response } from 'express';

import {
  getMailboxById,
  listMailboxes,
  fetchMailboxSummary,
  updateMailbox,
} from '../services/mailbox.service';

export async function getMailboxes(
  req: Request,
  res: Response
) {
  try {
    const result = await listMailboxes({
      connectionId: req.query.connectionId as string | undefined,

      type: req.query.type as
        | 'workspace'
        | 'smtp'
        | undefined,

      status: req.query.status as
        | 'active'
        | 'paused'
        | 'dropped'
        | undefined,

      search: req.query.search as string | undefined,

      page: req.query.page
        ? Number(req.query.page)
        : 1,

      limit: req.query.limit
        ? Number(req.query.limit)
        : 50,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(
      '[MAILBOXES] Failed to fetch mailboxes:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch mailboxes',
    });
  }
}

export async function getMailbox(
  req: Request,
  res: Response
) {
  try {
    const mailbox = await getMailboxById(
      req.params.mailboxId
    );

    return res.status(200).json({
      success: true,
      data: mailbox,
    });
  } catch (error: any) {
    const status =
      error.message === 'Mailbox not found'
        ? 404
        : 400;

    return res.status(status).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch mailbox',
    });
  }
}

export async function getMailboxSummary(
  req: Request,
  res: Response
) {
  try {
    const result =
      await fetchMailboxSummary({
        connectionId:
          req.query.connectionId as
          | string
          | undefined,
      });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(
      '[MAILBOXES] Failed to fetch summary:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch mailbox summary',
    });
  }
}

export async function patchMailbox(
  req: Request,
  res: Response
) {
  try {
    const {
      status,
      warmupStartDate,
      dailyCap,
    } = req.body;

    if (
      status === undefined &&
      warmupStartDate === undefined &&
      dailyCap === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          'No valid fields supplied for update',
      });
    }

    if (
      status !== undefined &&
      ![
        'active',
        'paused',
        'dropped',
      ].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid mailbox status',
      });
    }

    if (
      dailyCap !== undefined &&
      (
        !Number.isInteger(dailyCap) ||
        dailyCap < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'dailyCap must be a non-negative integer',
      });
    }

    const mailbox =
      await updateMailbox(
        req.params.mailboxId,
        {
          status,
          warmupStartDate:
            warmupStartDate !== undefined
              ? new Date(warmupStartDate)
              : undefined,
          dailyCap,
        }
      );

    return res.status(200).json({
      success: true,
      data: mailbox,
    });
  } catch (error: any) {
    const status =
      error.message === 'Mailbox not found'
        ? 404
        : 400;

    return res.status(status).json({
      success: false,
      message:
        error.message ||
        'Failed to update mailbox',
    });
  }
}