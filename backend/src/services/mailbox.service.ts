import {
  getMailwizzDb,
} from '../config/mailwizzDB';

interface ListMailboxOptions {
  connectionId?: string;
  type?: 'workspace' | 'smtp';
  status?: 'active' | 'paused' | 'dropped';
  search?: string;
  page?: number;
  limit?: number;
}

interface UpdateMailboxData {
  status?: 'active' | 'paused' | 'dropped';
  warmupStartDate?: Date;
  dailyCap?: number;
}

/**
 * MailWizz delivery-server table.
 *
 * IMPORTANT:
 * Your actual table prefix may be different.
 *
 * Typical MailWizz installation:
 * mw_delivery_server
 */
const DELIVERY_SERVER_TABLE =
  'mw_delivery_server';

export async function listMailboxes(
  options: ListMailboxOptions = {}
) {
  const {
    type,
    status,
    search,
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

  /*
   * MailWizz delivery servers normally have
   * their own status/type/provider information.
   */

  if (status) {
    conditions.push('ds.status = ?');
    params.push(status);
  }

  if (search) {
    conditions.push(`
      (
        ds.name LIKE ?
        OR ds.hostname LIKE ?
      )
    `);

    const searchValue = `%${search}%`;

    params.push(
      searchValue,
      searchValue
    );
  }

  /*
   * We intentionally don't force "workspace"
   * or "smtp" directly into SQL because MailWizz
   * has its own delivery-server type/provider
   * structure.
   *
   * We normalize it after reading the record.
   */

  const whereClause =
    conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

  const [rows] =
    await db.query(
      `
      SELECT
        ds.*
      FROM ${DELIVERY_SERVER_TABLE} ds
      ${whereClause}
      ORDER BY ds.delivery_server_id DESC
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
      FROM ${DELIVERY_SERVER_TABLE} ds
      ${whereClause}
      `,
      params
    );

  const total =
    Number(
      (countRows as any[])[0]?.total || 0
    );

  const items = (rows as any[]).map(
    normalizeMailwizzMailbox
  );

  /*
   * Apply our UI-level type filter AFTER
   * normalizing MailWizz's provider/type.
   */
  const filteredItems =
    type
      ? items.filter(
          (item) =>
            item.type === type
        )
      : items;

  return {
    items: filteredItems,

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

export async function getMailboxById(
  mailboxId: string
) {
  const db = await getMailwizzDb();

  const [rows] =
    await db.query(
      `
      SELECT
        ds.*
      FROM ${DELIVERY_SERVER_TABLE} ds
      WHERE ds.delivery_server_id = ?
      LIMIT 1
      `,
      [mailboxId]
    );

  const mailbox =
    (rows as any[])[0];

  if (!mailbox) {
    throw new Error(
      'Mailbox not found'
    );
  }

  return normalizeMailwizzMailbox(
    mailbox
  );
}

export async function fetchMailboxSummary(
  options: {
    connectionId?: string;
  } = {}
) {
  const db = await getMailwizzDb();

  const [rows] =
    await db.query(
      `
      SELECT
        COUNT(*) AS total,

        SUM(
          CASE
            WHEN status = 'active'
            THEN 1
            ELSE 0
          END
        ) AS active,

        SUM(
          CASE
            WHEN status = 'paused'
            THEN 1
            ELSE 0
          END
        ) AS paused,

        SUM(
          CASE
            WHEN status != 'active'
              AND status != 'paused'
            THEN 1
            ELSE 0
          END
        ) AS dropped

      FROM ${DELIVERY_SERVER_TABLE}
      `
    );

  const row =
    (rows as any[])[0] || {};

  /*
   * Workspace vs SMTP is normalized from
   * MailWizz server type/provider.
   *
   * We calculate it separately because
   * MailWizz's type names are not necessarily
   * exactly "workspace" / "smtp".
   */

  const [serverRows] =
    await db.query(
      `
      SELECT
        type,
        COUNT(*) AS count
      FROM ${DELIVERY_SERVER_TABLE}
      GROUP BY type
      `
    );

  const workspace =
    (serverRows as any[])
      .filter((row) =>
        isWorkspaceType(row.type)
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.count || 0),
        0
      );

  const smtp =
    (serverRows as any[])
      .filter((row) =>
        isSmtpType(row.type)
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.count || 0),
        0
      );

  return {
    total: Number(row.total || 0),
    workspace,
    smtp,
    active: Number(row.active || 0),
    paused: Number(row.paused || 0),
    dropped: Number(row.dropped || 0),
  };
}

/**
 * IMPORTANT:
 *
 * Mailbox updates need special handling.
 *
 * MailWizz is the source of truth for the
 * delivery-server itself.
 *
 * Therefore we should NOT allow our application
 * to overwrite MailWizz's email/hostname/provider
 * information.
 *
 * This function currently only returns the
 * MailWizz mailbox because dailyCap/warmupStartDate
 * are application-level fields and should NOT be
 * written into MailWizz unless we have explicitly
 * mapped them to MailWizz fields.
 */
export async function updateMailbox(
  mailboxId: string,
  data: UpdateMailboxData
) {
  const db = await getMailwizzDb();

  /*
   * First verify that the delivery server exists.
   */
  const [rows] =
    await db.query(
      `
      SELECT
        ds.*
      FROM ${DELIVERY_SERVER_TABLE} ds
      WHERE ds.delivery_server_id = ?
      LIMIT 1
      `,
      [mailboxId]
    );

  const mailbox =
    (rows as any[])[0];

  if (!mailbox) {
    throw new Error(
      'Mailbox not found'
    );
  }

  /*
   * DO NOT update MailWizz fields here
   * until we explicitly map them.
   *
   * warmupStartDate and dailyCap belong to
   * the Warmup Analytics application, not
   * necessarily to MailWizz.
   *
   * Those should eventually live in an
   * application metadata store.
   */

  return normalizeMailwizzMailbox(
    mailbox
  );
}

function normalizeMailwizzMailbox(
  row: any
) {
  return {
    id: row.delivery_server_id,

    emailAddress:
      row.email_address ||
      row.from_email ||
      row.name ||
      null,

    name:
      row.name || null,

    hostname:
      row.hostname || null,

    type: normalizeType(
      row.type,
      row.hostname,
      row.name
    ),

    provider:
      row.type || null,

    status:
      row.status || null,

    domain:
      extractDomain(
        row.email_address ||
        row.from_email ||
        row.name
      ),

    mailwizzDeliveryServerId:
      row.delivery_server_id,

    createdAt:
      row.date_added ||
      null,

    updatedAt:
      row.last_updated ||
      null,

    raw: row,
  };
}

function normalizeType(
  type: string | undefined,
  hostname?: string,
  name?: string
) {
  const value =
    `${type || ''} ${
      hostname || ''
    } ${name || ''}`.toLowerCase();

  if (
    value.includes('smtp')
  ) {
    return 'smtp';
  }

  if (
    value.includes('gmail') ||
    value.includes('google')
  ) {
    return 'workspace';
  }

  return 'smtp';
}

function isWorkspaceType(
  type?: string
) {
  const value =
    String(type || '')
      .toLowerCase();

  return (
    value.includes('gmail') ||
    value.includes('google')
  );
}

function isSmtpType(
  type?: string
) {
  const value =
    String(type || '')
      .toLowerCase();

  return (
    value.includes('smtp')
  );
}

function extractDomain(
  email?: string
) {
  if (!email) {
    return null;
  }

  const match =
    String(email).match(
      /@([^>\s]+)/
    );

  return match
    ? match[1].toLowerCase()
    : null;
}