// Mock data shaped to match what the backend API is expected to return.
// Used only when live API data is not available — see DATA RULE in project brief.
export const dashboardSummary = {
  emailsSent: 12540,
  emailsSentDeltaPct: 12.4,
  delivered: 12086,
  deliveryRate: 96.4,
  inboxPlacement: 7842,
  inboxPlacementPctOfDelivered: 64.9,
  spamPlacement: 3126,
  spamPlacementPctOfDelivered: 25.83,
  repliesReceived: 1256,
  replyRate: 10.4,
}

export const placementDistribution = {
  totalDelivered: 12086,
  inbox: 7842,
  spam: 3126,
  promotions: 1118,
  other: 228,
}

export const campaignTypeStats = [
  { type: 'Workspace → Employees', sent: 2450, delivered: 2401, deliveredPct: 98.0, inbox: 1832, inboxPct: 75.3, spam: 420, spamPct: 17.3, promotions: 149, replies: 180, replyPct: 7.49 },
  { type: 'SMTP → Employees', sent: 1950, delivered: 1812, deliveredPct: 92.9, inbox: 1081, inboxPct: 59.7, spam: 420, spamPct: 23.2, promotions: 181, replies: 64, replyPct: 3.60 },
  { type: 'Workspace → Gmail Seeds', sent: 5920, delivered: 5348, deliveredPct: 90.7, inbox: 3864, inboxPct: 72.1, spam: 1049, spamPct: 19.6, promotions: 434, replies: 745, replyPct: 12.34 },
  { type: 'SMTP → Gmail Seeds', sent: 2320, delivered: 2174, deliveredPct: 93.7, inbox: 1672, inboxPct: 76.8, spam: 308, spamPct: 14.2, promotions: 194, replies: 368, replyPct: 16.89 },
  { type: 'SMTP → Workspace', sent: 1850, delivered: 1720, deliveredPct: 93.0, inbox: 1240, inboxPct: 72.1, spam: 320, spamPct: 18.6, promotions: 160, replies: 145, replyPct: 8.43 },
  { type: 'Workspace → SMTP', sent: 1650, delivered: 1580, deliveredPct: 95.8, inbox: 1180, inboxPct: 74.7, spam: 260, spamPct: 16.5, promotions: 140, replies: 120, replyPct: 7.59 },
]

export const campaignTypeTotal = {
  sent: 16140,
  delivered: 15035,
  deliveredPct: 93.2,
  inbox: 10869,
  inboxPct: 72.3,
  spam: 2777,
  spamPct: 18.5,
  promotions: 1258,
  replies: 1622,
  replyPct: 10.79,
}

export type Account = {
  id: string
  email: string
  type: 'Workspace' | 'SMTP' | 'Seed / Test'
  domain: string
  provider: string
  customer: string
  status: 'Active' | 'Paused' | 'Suspended' | 'Blacklisted' | 'Dropped' | 'Error'
  warmupStage: string
  dailyLimit: number
  sent: number
  delivered: number
  inboxPct: number
  spamPct: number
  replies: number
  lastActivity: string
  createdAt: string
  ipAddress: string
  mailwizzServer: string
}

export const emailAccounts: Account[] = [
  { id: 'a1', email: 'sales01@cloudhead.ai', type: 'Workspace', domain: 'cloudhead.ai', provider: 'Google Workspace', customer: 'Warmup-A', status: 'Active', warmupStage: 'Stage 2', dailyLimit: 25, sent: 345, delivered: 338, inboxPct: 82.9, spamPct: 12.2, replies: 18, lastActivity: '2 min ago', createdAt: 'May 2, 2026', ipAddress: '—', mailwizzServer: '#15 - sales01@cloudhead.ai' },
  { id: 'a2', email: 'info@cloudwizz.com', type: 'Workspace', domain: 'cloudwizz.com', provider: 'Google Workspace', customer: 'Warmup-A', status: 'Active', warmupStage: 'Stage 3', dailyLimit: 35, sent: 312, delivered: 305, inboxPct: 78.5, spamPct: 15.1, replies: 25, lastActivity: '5 min ago', createdAt: 'Apr 18, 2026', ipAddress: '—', mailwizzServer: '#22 - info@cloudwizz.com' },
  { id: 'a3', email: 'user03@clouddeal.net', type: 'Workspace', domain: 'clouddeal.net', provider: 'Google Workspace', customer: 'Warmup-B', status: 'Active', warmupStage: 'Stage 1', dailyLimit: 15, sent: 98, delivered: 91, inboxPct: 63.2, spamPct: 28.6, replies: 4, lastActivity: '12 min ago', createdAt: 'Jun 1, 2026', ipAddress: '—', mailwizzServer: '#31 - user03@clouddeal.net' },
  { id: 'a4', email: 'support@realgrowth.com', type: 'Workspace', domain: 'realgrowth.com', provider: 'Google Workspace', customer: 'Warmup-B', status: 'Paused', warmupStage: 'Stage 1', dailyLimit: 15, sent: 45, delivered: 39, inboxPct: 60.0, spamPct: 24.4, replies: 1, lastActivity: '1 hr ago', createdAt: 'May 28, 2026', ipAddress: '—', mailwizzServer: '#34 - support@realgrowth.com' },
  { id: 'a5', email: 'smtp01@cloudsmtp.com', type: 'SMTP', domain: 'cloudsmtp.com', provider: '23.45.67.89', customer: 'Warmup-A', status: 'Suspended', warmupStage: 'Stage 1', dailyLimit: 10, sent: 12, delivered: 0, inboxPct: 0.0, spamPct: 100.0, replies: 0, lastActivity: '3 min ago', createdAt: 'Jun 10, 2026', ipAddress: '23.45.67.89', mailwizzServer: '#40 - smtp01@cloudsmtp.com' },
  { id: 'a6', email: 'smtp02@cloudsmtp.com', type: 'SMTP', domain: 'cloudsmtp.com', provider: '23.45.67.89', customer: 'Warmup-A', status: 'Blacklisted', warmupStage: 'Stage 0', dailyLimit: 0, sent: 0, delivered: 0, inboxPct: 0.0, spamPct: 0.0, replies: 0, lastActivity: '1 day ago', createdAt: 'Mar 2, 2026', ipAddress: '23.45.67.89', mailwizzServer: '#41 - smtp02@cloudsmtp.com' },
  { id: 'a7', email: 'smtp04@cloudsmtp.com', type: 'SMTP', domain: 'cloudsmtp.com', provider: '23.45.67.89', customer: 'Warmup-C', status: 'Active', warmupStage: 'Stage 3', dailyLimit: 30, sent: 346, delivered: 331, inboxPct: 71.4, spamPct: 21.3, replies: 16, lastActivity: '7 min ago', createdAt: 'Feb 14, 2026', ipAddress: '23.45.67.89', mailwizzServer: '#43 - smtp04@cloudsmtp.com' },
  { id: 'a8', email: 'seed01@gmail.com', type: 'Seed / Test', domain: 'gmail.com', provider: 'Gmail', customer: 'Warmup-A', status: 'Active', warmupStage: 'N/A', dailyLimit: 0, sent: 0, delivered: 0, inboxPct: 0, spamPct: 0, replies: 0, lastActivity: '15 min ago', createdAt: 'Jan 5, 2026', ipAddress: '—', mailwizzServer: '—' },
]

export const accountDetail = {
  a1: {
    ...emailAccounts[0],
    performance: {
      labels: ['May 20', 'May 21', 'May 22', 'May 23', 'May 24', 'May 25', 'May 26'],
      inbox: [58, 63, 60, 70, 74, 79, 83],
      spam: [30, 26, 28, 20, 18, 15, 12],
      replies: [4, 6, 5, 8, 9, 12, 14],
    },
  },
}

export const recentAlerts = [
  { id: 1, level: 'danger', text: 'smtp03@cloudsmtp.com is blacklisted on Spamhaus', when: '1 hr ago' },
  { id: 2, level: 'warn', text: 'High spam rate (45.7%) for support@realgrowth.com', when: '2 hrs ago' },
  { id: 3, level: 'danger', text: '23.45.67.89 has high 421 errors', when: '3 hrs ago' },
  { id: 4, level: 'warn', text: 'Domain realgrowth.com has high bounce rate', when: '5 hrs ago' },
]

export const postfixSummary = {
  received: 2864,
  delivered: { count: 2754, pct: 96.2 },
  deferred: { count: 67, pct: 2.3 },
  failed: { count: 31, pct: 1.1 },
  connectionErrors: 12,
  connectionErrorsPct: 0.4,
}

export const reputationStatus = [
  { domainOrIp: 'cloudhead.ai', googlePostmaster: 'Medium', microsoftSnds: 'Good', blacklists: 'Clean' },
  { domainOrIp: 'cloudwizz.com', googlePostmaster: 'Low', microsoftSnds: 'Good', blacklists: 'Clean' },
  { domainOrIp: 'cloudsmtp.com', googlePostmaster: 'High', microsoftSnds: 'Poor', blacklists: '2 Lists' },
  { domainOrIp: '23.45.67.89 (IP)', googlePostmaster: 'Medium', microsoftSnds: 'Poor', blacklists: '1 List' },
]

export const recentActivity = [
  { id: 1, kind: 'success', text: 'Email sent to seed01@gmail.com', when: '2 min ago' },
  { id: 2, kind: 'success', text: 'Reply received from seed01@gmail.com', when: '15 min ago' },
  { id: 3, kind: 'danger', text: 'Email landed in spam - seed02@gmail.com', when: '32 min ago' },
]

export const systemSummary = {
  workspaceAccounts: 50,
  smtpAccounts: 25,
  seedGmailAccounts: 50,
  employeeTestAccounts: 15,
  activeCampaigns: 14,
  pausedCampaigns: 2,
  completedToday: 6,
}

export const accountsKpi = {
  all: { total: 356, active: 298, activePct: 83.7, paused: 32, pausedPct: 9.0, dropped: 18, droppedPct: 5.1, error: 8, errorPct: 2.2, newThisWeek: 12 },
  smtp: { total: 125, active: 96, activePct: 76.8, paused: 12, pausedPct: 9.6, dropped: 10, droppedPct: 8.0, error: 7, errorPct: 5.6, newThisWeek: 7 },
  workspace: { total: 184, active: 142, activePct: 77.2, paused: 31, pausedPct: 16.8, dropped: 8, droppedPct: 4.3, error: 3, errorPct: 1.6, newThisWeek: 9 },
  seed: { total: 65, seedGmail: 50, seedGmailPct: 76.9, employeeTest: 15, employeeTestPct: 23.1, active: 63, activePct: 96.9, inactive: 2, inactivePct: 3.1, newThisWeek: 5 },
}

export const mailwizzConnections = [
  { id: 'mw1', name: 'MailWizz – License 1', url: 'https://mailwizz1.yourdomain.com', apiVersion: 'v2.0', connectedOn: 'May 10, 2026 10:30 AM', lastSync: '2 min ago', totalCustomers: 12, totalDeliveryServers: 75, status: 'Active' as const },
  { id: 'mw2', name: 'MailWizz – License 2', url: 'https://mailwizz2.yourdomain.com', apiVersion: 'v2.0', connectedOn: 'May 12, 2026 09:20 AM', lastSync: '3 min ago', totalCustomers: 8, totalDeliveryServers: 50, status: 'Active' as const },
  { id: 'mw3', name: 'MailWizz – License 3', url: 'https://mailwizz3.yourdomain.com', apiVersion: 'v1.4', connectedOn: 'May 15, 2026 11:45 AM', lastSync: '16 min ago', totalCustomers: 5, totalDeliveryServers: 25, status: 'Warning' as const },
]

export const mailwizzSyncSummary = { totalCustomers: 25, deliveryServers: 150, mailboxes: 298, lastSync: '2 min ago', lastSyncStatus: 'Success' }

export const workerStatus = {
  status: 'Running' as const,
  runningSince: '2h 34m',
  lastCheck: '2 min ago',
  nextCheckIn: '3 min',
  accountsMonitored: 65,
  emailsProcessedToday: 12540,
  emailsProcessedInboxPct: 81.9,
  monitored: { seedGmail: { checked: 50, total: 50 }, employeeTest: { checked: 15, total: 15 } },
  placementToday: { total: 12540, inbox: 10298, inboxPct: 81.9, spam: 1262, spamPct: 10.1, promotions: 480, promotionsPct: 3.8, notFound: 500, notFoundPct: 4.0 },
  logs: [
    { id: 1, kind: 'success', text: 'Successfully checked 65 accounts', when: '2 min ago' },
    { id: 2, kind: 'info', text: 'Inbox check completed', when: '2 min ago' },
    { id: 3, kind: 'info', text: 'Connected to Gmail API', when: '3 min ago' },
    { id: 4, kind: 'info', text: 'Connected to Microsoft 365', when: '3 min ago' },
    { id: 5, kind: 'success', text: 'Worker started', when: '2h 34m ago' },
  ],
  settings: { checkInterval: '2 minutes', retryFailed: true, moveSpamToInboxSeed: true, autoReplySeed: false },
}
