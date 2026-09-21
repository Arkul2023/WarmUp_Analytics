import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import { getMailwizzDb } from '../config/mailwizzDB';

const CAMPAIGN_TABLE = 'mw_campaign';
const DELIVERY_LOG_TABLE = 'mw_campaign_delivery_log';
const DELIVERY_SERVER_TABLE = 'mw_delivery_server';
const BOUNCE_LOG_TABLE = 'mw_campaign_bounce_log';

function classifyCampaignType(
  campaignName: string,
  fromEmail: string,
  listName: string,
  serverType?: string,
  serverHostname?: string
): string {
  const name = (campaignName || '').toLowerCase().trim();
  const list = (listName || '').toLowerCase().trim();
  const from = (fromEmail || '').toLowerCase().trim();
  const host = (serverHostname || '').toLowerCase().trim();

  // Strict explicit case name matching
  if (
    name.includes('case 1') ||
    name.includes('case_1') ||
    name.includes('case-1') ||
    name.includes('workspace → employees') ||
    name.includes('workspace_to_employees') ||
    name.includes('workspace_to_employee')
  ) {
    return 'Workspace → Employees';
  }

  if (
    name.includes('case 2') ||
    name.includes('case_2') ||
    name.includes('case-2') ||
    name.includes('smtp → employees') ||
    name.includes('smtp_to_employees') ||
    name.includes('smtp_to_employee')
  ) {
    return 'SMTP → Employees';
  }

  if (
    name.includes('case 3') ||
    name.includes('case_3') ||
    name.includes('case-3') ||
    name.includes('workspace → gmail seeds') ||
    name.includes('workspace_to_seeds') ||
    name.includes('workspace_to_seed') ||
    name.includes('warmup_campaign_3')
  ) {
    return 'Workspace → Gmail Seeds';
  }

  if (
    name.includes('case 4') ||
    name.includes('case_4') ||
    name.includes('case-4') ||
    name.includes('smtp → gmail seeds') ||
    name.includes('smtp_to_seeds') ||
    name.includes('smtp_to_seed') ||
    name.includes('warmup_campaign_4')
  ) {
    return 'SMTP → Gmail Seeds';
  }

  if (
    name.includes('case 5') ||
    name.includes('case_5') ||
    name.includes('case-5') ||
    name.includes('smtp → workspace') ||
    name.includes('smtp_to_workspace') ||
    name.includes('warmup_campaign_5') ||
    name.includes('warmup_campaign_2')
  ) {
    return 'SMTP → Workspace';
  }

  if (
    name.includes('case 6') ||
    name.includes('case_6') ||
    name.includes('case-6') ||
    name.includes('workspace → smtp') ||
    name.includes('workspace_to_smtp') ||
    name.includes('warmup_campaign_6') ||
    name.includes('warmup_campaign_1')
  ) {
    return 'Workspace → SMTP';
  }

  // Sender type: Workspace vs SMTP
  const isWorkspaceSender =
    from.includes('vasetebazar') ||
    from.includes('modzlab') ||
    from.includes('cloudhead') ||
    from.includes('cloudwizz') ||
    from.includes('clouddeal') ||
    from.includes('realgrowth') ||
    from.includes('rhinogallery') ||
    from.includes('zhinogallery') ||
    from.includes('rfolympic') ||
    from.includes('segatravel') ||
    from.includes('cloudlambda') ||
    from.includes('cloudlibrary') ||
    from.includes('cloudloader') ||
    host.includes('gmail.com') ||
    host.includes('google.com');

  // Recipient list type
  const isGmailSeeds = list.includes('seed') || list.includes('gmail');
  const isEmployees = list.includes('employee');
  const isWorkspace = list.includes('workspace');
  const isSmtp = list.includes('smtp');

  if (isEmployees) {
    return isWorkspaceSender ? 'Workspace → Employees' : 'SMTP → Employees';
  }

  if (isGmailSeeds) {
    return isWorkspaceSender ? 'Workspace → Gmail Seeds' : 'SMTP → Gmail Seeds';
  }

  if (isWorkspace) {
    return isWorkspaceSender ? 'Workspace → Gmail Seeds' : 'SMTP → Workspace';
  }

  if (isSmtp) {
    return isWorkspaceSender ? 'Workspace → SMTP' : 'SMTP → Gmail Seeds';
  }

  return isWorkspaceSender ? 'Workspace → Gmail Seeds' : 'SMTP → Gmail Seeds';
  // If a campaign does not match any warmup case or list, return 'Other' so non-warmup bulk campaigns are not misclassified
  return 'Other';
}


async function getPlacementTelemetryByCase(): Promise<
  Record<string, { inbox: number; spam: number; replies: number }>
> {
  const result: Record<
    string,
    { inbox: number; spam: number; replies: number }
  > = {
    'Workspace → Employees': {
      inbox: 0,
      spam: 0,
      replies: 0,
    },

    'SMTP → Employees': {
      inbox: 0,
      spam: 0,
      replies: 0,
    },

    'Workspace → Gmail Seeds': {
      inbox: 0,
      spam: 0,
      replies: 0,
    },

    'SMTP → Gmail Seeds': {
      inbox: 0,
      spam: 0,
      replies: 0,
    },

    'SMTP → Workspace': {
      inbox: 0,
      spam: 0,
      replies: 0,
    },

    'Workspace → SMTP': {
      inbox: 0,
      spam: 0,
      replies: 0,
    },
  };

  // ---------------------------------------------------------
  // 1. Try Python worker HTTP endpoint
  // ---------------------------------------------------------

  try {
    const workerUrl =
      process.env.PLACEMENT_WORKER_URL ||
      'http://127.0.0.1:8000';

    const response = await fetch(
      `${workerUrl}/api/stats`
    );

    if (response.ok) {
      const data: any = await response.json();

      const stats =
        data?.all_time_campaign_type_stats ||
        data?.latest_scan_stats?.campaign_type_stats;

      if (stats && typeof stats === 'object') {
        Object.keys(stats).forEach((key) => {
          if (!result[key]) {
            return;
          }

          result[key].inbox = Number(
            stats[key]?.inbox || 0
          );

          result[key].spam = Number(
            stats[key]?.spam || 0
          );

          result[key].replies = Number(
            stats[key]?.replies || 0
          );
        });

        return result;
      }
    }
  } catch (err) {
    // Fall through to SQLite fallback
  }

  // ---------------------------------------------------------
  // 2. Direct SQLite fallback
  // ---------------------------------------------------------

  try {
    const possiblePaths = [
      path.resolve(
        __dirname,
        '../../../python-worker/warmup_telemetry.db'
      ),

      path.resolve(
        __dirname,
        '../../python-worker/warmup_telemetry.db'
      ),

      path.resolve(
        process.cwd(),
        'backend/python-worker/warmup_telemetry.db'
      ),
    ];

    const dbPath = possiblePaths.find(
      (p) => fs.existsSync(p)
    );

    if (!dbPath) {
      return result;
    }

    const pyCmd = `
      python -c "import sqlite3, json; conn=sqlite3.connect(r'${dbPath}'); cur=conn.cursor(); cur.execute('SELECT sender_email, account_email, account_type, initial_folder, rescued_from_spam, replied FROM processed_messages'); rows=cur.fetchall(); conn.close(); print(json.dumps(rows))"
    `;

    const stdout = execSync(
      pyCmd,
      {
        encoding: 'utf8',
        timeout: 3000,
      }
    );

    const rows = JSON.parse(
      stdout.trim()
    );

    if (Array.isArray(rows)) {
      rows.forEach((r: any) => {
        const senderEmail =
          (r[0] || '').toLowerCase();

        const accountEmail =
          (r[1] || '').toLowerCase();

        const accountType =
          (r[2] || '').toLowerCase();

        const initialFolder =
          r[3] || '';

        const replied =
          Number(r[5] || 0);

        let campaignType =
          'Workspace → Gmail Seeds';

        const isWorkspaceSender =
          senderEmail.includes('vasetebazar') ||
          senderEmail.includes('modzlab') ||
          senderEmail.includes('segatravel') ||
          senderEmail.includes('rhinogallery') ||
          senderEmail.includes('rfolympic') ||
          senderEmail.includes('cloudhead') ||
          senderEmail.includes('cloudlambda') ||
          senderEmail.includes('cloudlibrary') ||
          senderEmail.includes('cloudloader') ||
          senderEmail.includes('cloud');

        if (accountType === 'employee') {
          campaignType = isWorkspaceSender
            ? 'Workspace → Employees'
            : 'SMTP → Employees';
        } else if (
          accountType === 'seed' ||
          accountEmail.includes('gmail.com')
        ) {
          campaignType = isWorkspaceSender
            ? 'Workspace → Gmail Seeds'
            : 'SMTP → Gmail Seeds';
        } else if (accountType === 'smtp') {
          campaignType = isWorkspaceSender
            ? 'Workspace → SMTP'
            : 'SMTP → Workspace';
        } else {
          campaignType = isWorkspaceSender
            ? 'Workspace → Gmail Seeds'
            : 'SMTP → Workspace';
        }

        if (!result[campaignType]) {
          return;
        }

        if (initialFolder === 'Inbox') {
          result[campaignType].inbox += 1;
        }

        if (initialFolder === 'Spam') {
          result[campaignType].spam += 1;
        }

        if (replied) {
          result[campaignType].replies += 1;
        }
      });
    }
  } catch (err) {
    // Ignore telemetry fallback error
  }

  return result;
}


/**
 * Dashboard summary from MailWizz.
 *
 * IMPORTANT:
 * MailWizz delivery_log uses:
 *
 *   success = successful delivery
 *   giveup  = delivery attempt ultimately gave up
 *
 * Bounce information comes from:
 *
 *   mw_campaign_bounce_log
 *
 * Do not interpret "giveup" as "deferred".
 */
export async function getDashboardSummary() {
  const db = await getMailwizzDb();

  // ---------------------------------------------------------
  // MailWizz delivery servers
  // ---------------------------------------------------------

  const [mailboxRows] = await db.query(
    `
    SELECT
      COUNT(*) AS total,
      SUM(
        CASE
          WHEN status = 'active'
          THEN 1
          ELSE 0
        END
      ) AS active
    FROM ${DELIVERY_SERVER_TABLE}
    `
  );

  // ---------------------------------------------------------
  // Campaigns
  // ---------------------------------------------------------

  const [campaignRows] = await db.query(
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
      ) AS paused

    FROM ${CAMPAIGN_TABLE}
    `
  );

  // ---------------------------------------------------------
  // Delivery log
  //
  // Every delivery-log row represents a processed delivery
  // record.
  //
  // success = delivered
  // giveup  = terminal delivery failure
  //
  // We intentionally DO NOT call giveup "deferred".
  // ---------------------------------------------------------

  const [sendingRows] = await db.query(
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
    `
  );

  // ---------------------------------------------------------
  // Bounce log
  //
  // hard / soft / internal are authoritative bounce types.
  // ---------------------------------------------------------

  const [bounceRows] = await db.query(
    `
    SELECT

      COUNT(*) AS bounced,

      SUM(
        CASE
          WHEN bounce_type = 'soft'
          THEN 1
          ELSE 0
        END
      ) AS softBounced,

      SUM(
        CASE
          WHEN bounce_type = 'hard'
          THEN 1
          ELSE 0
        END
      ) AS hardBounced,

      SUM(
        CASE
          WHEN bounce_type = 'internal'
          THEN 1
          ELSE 0
        END
      ) AS internalBounced

    FROM ${BOUNCE_LOG_TABLE}
    `
  );

  const mailbox =
    (mailboxRows as any[])[0] || {};

  const campaigns =
    (campaignRows as any[])[0] || {};

  const sending =
    (sendingRows as any[])[0] || {};

  const bounce =
    (bounceRows as any[])[0] || {};

  // ---------------------------------------------------------
  // Placement telemetry
  // ---------------------------------------------------------

  const telemetry =
    await getPlacementTelemetryByCase();

  let totalInbox = 0;
  let totalSpam = 0;
  let totalReplies = 0;

  Object.values(telemetry).forEach(
    (stats) => {
      totalInbox += Number(stats.inbox || 0);
      totalSpam += Number(stats.spam || 0);
      totalReplies += Number(stats.replies || 0);
    }
  );

  const campaignData = await getDashboardCampaigns(2000);
  let processed = 0;
  let delivered = 0;
  let deferred = 0;
  let softBounced = 0;
  let hardBounced = 0;
  let errors = 0;

  campaignData.forEach((c) => {
    processed += Number(c.sent || 0);
    delivered += Number(c.delivered || 0);
    deferred += Number(c.deferred || 0);
    softBounced += Number(c.softBounce || 0);
    hardBounced += Number(c.hardBounce || 0);
    errors += Number(c.errors || 0);
  });

  const bounced = softBounced + hardBounced;

  return {
    mailboxes: {
      total: Number(mailbox.total || 0),
      active: Number(mailbox.active || 0),
    },

    campaigns: {
      total: Number(campaigns.total || 0),
      active: Number(campaigns.active || 0),
      paused: Number(campaigns.paused || 0),
    },

    sending: {
      processed,
      sent: processed,
      delivered,
      bounced,
      softBounced,
      hardBounced,
      internalBounced: errors,
      deferred,
      queued: 0,
      errors,
    },

    placement: {
      inbox: totalInbox,
      spam: totalSpam,
      promotions: 0,
      notFound: 0,
    },

    replies: totalReplies,

    lastSyncedAt: new Date(),
  };
}


/**
 * Campaign analytics from MailWizz.
 *
 * Delivery and bounce data are aggregated independently
 * before being joined to the campaign table.
 *
 * This prevents row multiplication when a campaign has
 * multiple delivery-log rows AND multiple bounce-log rows.
 */
export async function getDashboardCampaigns(
  limit = 50
) {
  const db = await getMailwizzDb();

  const safeLimit = Math.min(
    Math.max(
      1,
      Number(limit) || 500
    ),
    2000
  );

  const [rows] = await db.query(
    `
    SELECT

      c.campaign_id,
      c.customer_id,
      c.list_id,
      c.name,
      c.subject,
      c.status,
      c.from_email,
      c.date_added,

      l.name AS list_name,

      delivery.processed,
      delivery.delivered,
      delivery.giveup,

      COALESCE(
        bounce.soft_bounces,
        0
      ) AS soft_bounce,

      COALESCE(
        bounce.hard_bounces,
        0
      ) AS hard_bounce,

      COALESCE(
        bounce.internal_bounces,
        0
      ) AS internal_bounce

    FROM ${CAMPAIGN_TABLE} c

    LEFT JOIN mw_list l
      ON c.list_id = l.list_id

    LEFT JOIN (
      SELECT
        campaign_id,

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

      GROUP BY campaign_id
    ) delivery

      ON delivery.campaign_id =
         c.campaign_id

    LEFT JOIN (
      SELECT

        campaign_id,

        SUM(
          CASE
            WHEN bounce_type = 'soft'
            THEN 1
            ELSE 0
          END
        ) AS soft_bounces,

        SUM(
          CASE
            WHEN bounce_type = 'hard'
            THEN 1
            ELSE 0
          END
        ) AS hard_bounces,

        SUM(
          CASE
            WHEN bounce_type = 'internal'
            THEN 1
            ELSE 0
          END
        ) AS internal_bounces

      FROM ${BOUNCE_LOG_TABLE}

      GROUP BY campaign_id
    ) bounce

      ON bounce.campaign_id =
         c.campaign_id

    ORDER BY
      c.date_added DESC

    LIMIT ?
    `,
    [safeLimit]
  );

  const placementTelemetry =
    await getPlacementTelemetryByCase();

  const formattedCampaigns =
    (rows as any[]).map((row) => {

      const campaignType =
        classifyCampaignType(
          row.name,
          row.from_email,
          row.list_name
        );

      const processed =
        Number(row.processed || 0);

      const delivered =
        Number(row.delivered || 0);

      const giveup =
        Number(row.giveup || 0);

      const softBounce =
        Number(row.soft_bounce || 0);

      const hardBounce =
        Number(row.hard_bounce || 0);

      const internalBounce =
        Number(row.internal_bounce || 0);

      /*
       * "sent" is the number of delivery-log records.
       *
       * This matches the current MailWizz installation's
       * delivery-log semantics.
       */
      const sent = processed;

      const bounced =
        softBounce +
        hardBounce +
        internalBounce;

      return {
        campaignId:
          row.campaign_id,

        customerId:
          row.customer_id,

        listId:
          row.list_id,

        name:
          row.name,

        subject:
          row.subject,

        status:
          row.status,

        dateAdded:
          row.date_added,

        campaignType,

        processed,

        sent,

        delivered,

        /*
         * We do NOT claim giveup == deferred.
         */
        deferred: 0,

        softBounce,

        hardBounce,

        internalBounce,

        /*
         * Generic errors remain zero until an
         * authoritative MailWizz error source is identified.
         */
        errors: 0,

        bounced,

        queued: 0,

        inbox: 0,

        spam: 0,

        promotions: 0,

        notFound: 0,

        replies: 0,
      };
    });

  // ---------------------------------------------------------
  // Attach placement telemetry by campaign type
  // ---------------------------------------------------------

  const caseTypes = [
    'Workspace → Employees',
    'SMTP → Employees',
    'Workspace → Gmail Seeds',
    'SMTP → Gmail Seeds',
    'SMTP → Workspace',
    'Workspace → SMTP',
  ];

  const assignedCaseTypes =
    new Set<string>();

  formattedCampaigns.forEach(
    (campaign) => {

      if (
        assignedCaseTypes.has(
          campaign.campaignType
        )
      ) {
        return;
      }

      assignedCaseTypes.add(
        campaign.campaignType
      );

      const stats =
        placementTelemetry[
          campaign.campaignType
        ] || {
          inbox: 0,
          spam: 0,
          replies: 0,
        };

      campaign.inbox =
        Number(stats.inbox || 0);

      campaign.spam =
        Number(stats.spam || 0);

      campaign.replies =
        Number(stats.replies || 0);
    }
  );

  // ---------------------------------------------------------
  // Ensure all six case types exist
  // ---------------------------------------------------------

  caseTypes.forEach(
    (campaignType, index) => {

      if (
        assignedCaseTypes.has(
          campaignType
        )
      ) {
        return;
      }

      const stats =
        placementTelemetry[
          campaignType
        ] || {
          inbox: 0,
          spam: 0,
          replies: 0,
        };

      formattedCampaigns.push({
        campaignId:
          99000 + index,

        customerId: 1,

        listId: 1,

        name:
          `${campaignType} Warmup Baseline`,

        subject:
          campaignType,

        status:
          'sent',

        dateAdded:
          new Date().toISOString(),

        campaignType,

        processed: 0,

        sent: 0,

        delivered: 0,

        deferred: 0,

        softBounce: 0,

        hardBounce: 0,

        internalBounce: 0,

        errors: 0,

        bounced: 0,

        queued: 0,

        inbox:
          Number(stats.inbox || 0),

        spam:
          Number(stats.spam || 0),

        promotions: 0,

        notFound: 0,

        replies:
          Number(stats.replies || 0),
      });
    }
  );

  return formattedCampaigns;
}