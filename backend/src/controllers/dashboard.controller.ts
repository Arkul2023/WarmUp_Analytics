import {
  Request,
  Response,
} from 'express';

import {
  getDashboardSummary,
  getDashboardCampaigns,
} from '../services/dashboard.service';

export async function dashboardSummary(
  req: Request,
  res: Response
) {
  try {
    const data =
      await getDashboardSummary();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error(
      '[DASHBOARD] Summary failed:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to load dashboard summary',
    });
  }
}

export async function dashboardCampaigns(
  req: Request,
  res: Response
) {
  try {
    const limit =
      req.query.limit
        ? Number(
            req.query.limit
          )
        : 10;

    const data =
      await getDashboardCampaigns(
        limit
      );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error(
      '[DASHBOARD] Campaigns failed:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to load dashboard campaigns',
    });
  }
}