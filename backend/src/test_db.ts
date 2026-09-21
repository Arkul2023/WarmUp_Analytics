import { testMailwizzDbConnection, getMailwizzDb } from './config/mailwizzDB';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  try {
    await testMailwizzDbConnection();
    const db = getMailwizzDb();

    // Query campaigns with lists
    const [rows]: any = await db.query(`
      SELECT 
        c.campaign_id, c.name as campaign_name, c.from_email, c.status,
        l.name as list_name
      FROM mw_campaign c
      LEFT JOIN mw_list l ON c.list_id = l.list_id
      ORDER BY c.date_added DESC
      LIMIT 30
    `);
    console.log('--- RECENT CAMPAIGNS & LISTS ---');
    console.log(rows);

    console.log('=== BOUNCE LOG SUMMARY BY BOUNCE_TYPE ===');
    const [bounceSummary]: any = await db.query(
      'SELECT bounce_type, COUNT(*) as cnt, COUNT(DISTINCT campaign_id) as distinct_campaigns, COUNT(DISTINCT subscriber_id) as distinct_subscribers FROM mw_campaign_bounce_log GROUP BY bounce_type'
    );
    console.log(bounceSummary);

    console.log('\n=== BOUNCE LOGS BY CAMPAIGN_ID AND BOUNCE_TYPE ===');
    const [byCampaign]: any = await db.query(
      'SELECT campaign_id, bounce_type, COUNT(*) as cnt FROM mw_campaign_bounce_log GROUP BY campaign_id, bounce_type ORDER BY cnt DESC LIMIT 30'
    );
    console.log(byCampaign);

    function classifyCampaignType(
      campaignName: string,
      fromEmail: string,
      listName: string,
      serverHostname?: string
    ): string {
      const name = (campaignName || '').toLowerCase().trim();
      const list = (listName || '').toLowerCase().trim();
      const from = (fromEmail || '').toLowerCase().trim();
      const host = (serverHostname || '').toLowerCase().trim();

      if (
        name.includes('case 1') || name.includes('case_1') || name.includes('case-1') ||
        name.includes('workspace → employees') || name.includes('workspace_to_employees') || name.includes('workspace_to_employee')
      ) return 'Workspace → Employees';

      if (
        name.includes('case 2') || name.includes('case_2') || name.includes('case-2') ||
        name.includes('smtp → employees') || name.includes('smtp_to_employees') || name.includes('smtp_to_employee')
      ) return 'SMTP → Employees';

      if (
        name.includes('case 3') || name.includes('case_3') || name.includes('case-3') ||
        name.includes('workspace → gmail seeds') || name.includes('workspace_to_seeds') || name.includes('workspace_to_seed') ||
        name.includes('warmup_campaign_3')
      ) return 'Workspace → Gmail Seeds';

      if (
        name.includes('case 4') || name.includes('case_4') || name.includes('case-4') ||
        name.includes('smtp → gmail seeds') || name.includes('smtp_to_seeds') || name.includes('smtp_to_seed') ||
        name.includes('warmup_campaign_4')
      ) return 'SMTP → Gmail Seeds';

      if (
        name.includes('case 5') || name.includes('case_5') || name.includes('case-5') ||
        name.includes('smtp → workspace') || name.includes('smtp_to_workspace') ||
        name.includes('warmup_campaign_5') || name.includes('warmup_campaign_2')
      ) return 'SMTP → Workspace';

      if (
        name.includes('case 6') || name.includes('case_6') || name.includes('case-6') ||
        name.includes('workspace → smtp') || name.includes('workspace_to_smtp') ||
        name.includes('warmup_campaign_6') || name.includes('warmup_campaign_1')
      ) return 'Workspace → SMTP';

      const isWorkspaceSender =
        from.includes('vasetebazar') || from.includes('modzlab') || from.includes('cloudhead') ||
        from.includes('cloudwizz') || from.includes('clouddeal') || from.includes('realgrowth') ||
        from.includes('rhinogallery') || from.includes('zhinogallery') || from.includes('rfolympic') ||
        from.includes('segatravel') || from.includes('cloudlambda') || from.includes('cloudlibrary') ||
        from.includes('cloudloader') || host.includes('gmail.com') || host.includes('google.com');

      const isGmailSeeds = list.includes('seed') || list.includes('gmail');
      const isEmployees = list.includes('employee');
      const isWorkspace = list.includes('workspace');
      const isSmtp = list.includes('smtp');

      if (isEmployees) return isWorkspaceSender ? 'Workspace → Employees' : 'SMTP → Employees';
      if (isGmailSeeds) return isWorkspaceSender ? 'Workspace → Gmail Seeds' : 'SMTP → Gmail Seeds';
      if (isWorkspace) return isWorkspaceSender ? 'Workspace → Gmail Seeds' : 'SMTP → Workspace';
      if (isSmtp) return isWorkspaceSender ? 'Workspace → SMTP' : 'SMTP → Gmail Seeds';

      return 'Other';
    }

    const [allCampaigns]: any = await db.query(
      `SELECT c.campaign_id, c.name, c.from_email, l.name as list_name,
              COALESCE(d.delivery_count, 0) as sent,
              COALESCE(d.delivered_count, 0) as delivered,
              COALESCE(b.soft_bounces, 0) as softBounce,
              COALESCE(b.hard_bounces, 0) as hardBounce,
              COALESCE(b.internal_bounces, 0) as internalBounce
       FROM mw_campaign c
       LEFT JOIN mw_list l ON c.list_id = l.list_id
       LEFT JOIN (
         SELECT campaign_id,
                COUNT(*) as delivery_count,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as delivered_count
         FROM mw_campaign_delivery_log
         GROUP BY campaign_id
       ) d ON c.campaign_id = d.campaign_id
       LEFT JOIN (
         SELECT campaign_id,
                SUM(CASE WHEN bounce_type = 'soft' THEN 1 ELSE 0 END) AS soft_bounces,
                SUM(CASE WHEN bounce_type = 'hard' THEN 1 ELSE 0 END) AS hard_bounces,
                SUM(CASE WHEN bounce_type = 'internal' THEN 1 ELSE 0 END) AS internal_bounces
         FROM mw_campaign_bounce_log
         GROUP BY campaign_id
       ) b ON c.campaign_id = b.campaign_id`
    );

    const cases = [
      'Workspace → Employees',
      'SMTP → Employees',
      'Workspace → Gmail Seeds',
      'SMTP → Gmail Seeds',
      'SMTP → Workspace',
      'Workspace → SMTP',
    ];

    console.log('\n=== REAL-TIME CAMPAIGN STATS FOR THE 6 CASES ===');
    cases.forEach(cName => {
      const matched = allCampaigns.filter((c: any) => classifyCampaignType(c.name, c.from_email, c.list_name) === cName);
      const agg = matched.reduce((acc: any, c: any) => ({
        sent: acc.sent + Number(c.sent),
        delivered: acc.delivered + Number(c.delivered),
        softBounce: acc.softBounce + Number(c.softBounce),
        hardBounce: acc.hardBounce + Number(c.hardBounce),
        internalBounce: acc.internalBounce + Number(c.internalBounce),
      }), { sent: 0, delivered: 0, softBounce: 0, hardBounce: 0, internalBounce: 0 });

      console.log(`${cName}: campaigns=${matched.length}`, agg);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();

