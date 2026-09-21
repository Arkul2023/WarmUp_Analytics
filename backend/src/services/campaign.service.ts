import {
  getMailwizzDb,
} from '../config/mailwizzDB';

interface ListCampaignOptions {
  connectionId?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

const CAMPAIGN_TABLE = 'mw_campaign';

const CUSTOMER_TABLE = 'mw_customer';

const LIST_TABLE = 'mw_list';

const DELIVERY_LOG_TABLE =
  'mw_campaign_delivery_log';

const BOUNCE_LOG_TABLE =
  'mw_campaign_bounce_log';

/**
 * GET /api/campaigns
 *
 * Reads campaign inventory directly from
 * the connected MailWizz MariaDB database.
 */
export async function listCampaigns(
  options: ListCampaignOptions = {}
) {
  const {
    search,
    status,
    page = 1,
    limit = 50,
  } = options;

  const db = await getMailwizzDb();

  const safePage = Math.max(
    1,
    Number(page) || 1
  );

  const safeLimit = Math.min(
    Math.max(
      1,
      Number(limit) || 50
    ),
    100
  );

  const offset =
    (safePage - 1) * safeLimit;

  const conditions: string[] = [];

  const params: any[] = [];

  if (search) {
    conditions.push(`
      (
        c.name LIKE ?
        OR c.subject LIKE ?
      )
    `);

    const value = `%${search}%`;

    params.push(
      value,
      value
    );
  }

  if (status) {
    conditions.push(
      'c.status = ?'
    );

    params.push(status);
  }

  const whereClause =
    conditions.length
      ? `WHERE ${conditions.join(
        ' AND '
      )}`
      : '';

  const [rows] =
    await db.query(
      `
      SELECT
        c.campaign_id,
        c.customer_id,
        c.list_id,
        c.name,
        c.subject,
        c.status,
        c.date_added,
        c.date_updated,

        cu.name AS customer_name,

        l.name AS list_name

      FROM ${CAMPAIGN_TABLE} c

      LEFT JOIN ${CUSTOMER_TABLE} cu
        ON cu.customer_id =
           c.customer_id

      LEFT JOIN ${LIST_TABLE} l
        ON l.list_id =
           c.list_id

      ${whereClause}

      ORDER BY c.date_added DESC

      LIMIT ? OFFSET ?
      `,
      [
        ...params,
        safeLimit,
        offset,
      ]
    );

  const [countRows] =
    await db.query(
      `
      SELECT COUNT(*) AS total

      FROM ${CAMPAIGN_TABLE} c

      ${whereClause}
      `,
      params
    );

  const total =
    Number(
      (countRows as any[])[0]
        ?.total || 0
    );

  const campaigns =
    await Promise.all(
      (rows as any[]).map(
        async (campaign) => {
          const stats =
            await getCampaignStats(
              String(
                campaign.campaign_id
              )
            );

          return {
            ...normalizeCampaign(
              campaign
            ),
            stats,
          };
        }
      )
    );

  return {
    items: campaigns,

    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages:
        Math.ceil(
          total / safeLimit
        ),
    },
  };
}

/**
 * GET /api/campaigns/:campaignId
 */
export async function getCampaignById(
  campaignId: string
) {
  const db = await getMailwizzDb();

  const [rows] =
    await db.query(
      `
      SELECT
        c.*,

        cu.name AS customer_name,

        l.name AS list_name

      FROM ${CAMPAIGN_TABLE} c

      LEFT JOIN ${CUSTOMER_TABLE} cu
        ON cu.customer_id =
           c.customer_id

      LEFT JOIN ${LIST_TABLE} l
        ON l.list_id =
           c.list_id

      WHERE c.campaign_id = ?

      LIMIT 1
      `,
      [campaignId]
    );

  const campaign =
    (rows as any[])[0];

  if (!campaign) {
    throw new Error(
      'Campaign not found'
    );
  }

  const stats =
    await getCampaignStats(
      campaignId
    );

  return {
    campaign:
      normalizeCampaign(
        campaign
      ),

    stats,
  };
}

/**
 * Campaign sending statistics.
 *
 * IMPORTANT:
 *
 * These are MailWizz-side numbers.
 *
 * Inbox / Spam / Promotions do NOT
 * come from this function.
 */
export async function getCampaignStats(
  campaignId: string
) {
  const db = await getMailwizzDb();

  /*
   * MailWizz delivery log:
   *   success = successfully delivered
   *   giveup  = delivery attempt failed/gave up
   *
   * MailWizz bounce log:
   *   hard     = hard bounce
   *   soft     = soft bounce
   *   internal = internal bounce
   *
   * IMPORTANT:
   * Do NOT join the raw delivery and bounce tables together,
   * because that can multiply rows and produce incorrect counts.
   */

  const [deliveryRows] = await db.query(
    `
    SELECT
      COUNT(*) AS processed,

      SUM(
        CASE
          WHEN status = 'success'
          THEN 1
          ELSE 0
        END
      ) AS delivered,

      SUM(
        CASE
          WHEN status = 'giveup'
          THEN 1
          ELSE 0
        END
      ) AS giveup

    FROM ${DELIVERY_LOG_TABLE}

    WHERE campaign_id = ?
    `,
    [campaignId]
  );

  const [bounceRows] = await db.query(
    `
    SELECT

      SUM(
        CASE
          WHEN bounce_type = 'hard'
          THEN 1
          ELSE 0
        END
      ) AS hard_bounced,

      SUM(
        CASE
          WHEN bounce_type = 'soft'
          THEN 1
          ELSE 0
        END
      ) AS soft_bounced,

      SUM(
        CASE
          WHEN bounce_type = 'internal'
          THEN 1
          ELSE 0
        END
      ) AS internal_bounced

    FROM mw_campaign_bounce_log

    WHERE campaign_id = ?
    `,
    [campaignId]
  );

  const delivery =
    (deliveryRows as any[])[0] || {};

  const bounce =
    (bounceRows as any[])[0] || {};

  const processed =
    Number(delivery.processed || 0);

  const delivered =
    Number(delivery.delivered || 0);

  const giveup =
    Number(delivery.giveup || 0);

  const hardBounced =
    Number(bounce.hard_bounced || 0);

  const softBounced =
    Number(bounce.soft_bounced || 0);

  const internalBounced =
    Number(bounce.internal_bounced || 0);

  /*
   * A delivery-log record represents a processed
   * delivery attempt.
   *
   * We expose sent as the number of delivery
   * records for this campaign.
   */
  const sent = processed;

  /*
   * Total bounced is derived from the actual
   * MailWizz bounce log.
   */
  const bounced =
    hardBounced +
    softBounced +
    internalBounced;

  return {
    processed,

    sent,

    delivered,

    bounced,

    softBounced,

    hardBounced,

    internalBounced,

    /*
     * These cannot safely be inferred from the
     * current delivery_log status values.
     *
     * Keep them at zero until their authoritative
     * MailWizz source is identified.
     */
    deferred: 0,

    queued: 0,

    errors: 0,

    /*
     * Useful diagnostic value.
     * Not displayed unless the frontend chooses to use it.
     */
    giveup,
  };
}
/**
 * GET /api/campaigns/:campaignId/events
 *
 * Individual MailWizz delivery records.
 */
export async function getCampaignEvents(
  campaignId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}
) {
  const db = await getMailwizzDb();

  const page =
    Math.max(
      1,
      Number(options.page) || 1
    );

  const limit =
    Math.min(
      Math.max(
        1,
        Number(options.limit) || 50
      ),
      200
    );

  const offset =
    (page - 1) * limit;

  const conditions = [
    'cdl.campaign_id = ?',
  ];

  const params: any[] = [
    campaignId,
  ];

  if (options.status) {
    conditions.push(
      'cdl.status = ?'
    );

    params.push(
      options.status
    );
  }

  const whereClause =
    conditions.join(
      ' AND '
    );

  const [rows] =
    await db.query(
      `
      SELECT
        cdl.*

      FROM ${DELIVERY_LOG_TABLE} cdl

      WHERE ${whereClause}

      ORDER BY cdl.log_id DESC

      LIMIT ? OFFSET ?
      `,
      [
        ...params,
        limit,
        offset,
      ]
    );

  const [countRows] =
    await db.query(
      `
      SELECT COUNT(*) AS total

      FROM ${DELIVERY_LOG_TABLE} cdl

      WHERE ${whereClause}
      `,
      params
    );

  const total =
    Number(
      (countRows as any[])[0]
        ?.total || 0
    );

  return {
    items: rows,

    pagination: {
      page,
      limit,
      total,
      totalPages:
        Math.ceil(
          total / limit
        ),
    },
  };
}

/**
 * Normalizes MailWizz campaign data
 * for the frontend.
 */
function normalizeCampaign(
  row: any
) {
  return {
    id:
      row.campaign_id,

    mailwizzCampaignId:
      row.campaign_id,

    customerId:
      row.customer_id,

    customerName:
      row.customer_name ||
      null,

    listId:
      row.list_id,

    listName:
      row.list_name ||
      null,

    name:
      row.name ||
      null,

    subject:
      row.subject ||
      null,

    status:
      row.status ||
      null,

    dateAdded:
      row.date_added ||
      null,

    dateUpdated:
      row.date_updated ||
      null,
  };
}