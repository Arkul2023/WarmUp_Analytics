import {
  Request,
  Response,
} from 'express';

import {
  listCampaigns,
  getCampaignById,
  getCampaignStats,
  getCampaignEvents,
} from '../services/campaign.service';

export async function getCampaigns(
  req: Request,
  res: Response
) {
  try {
    const result =
      await listCampaigns({
        connectionId:
          req.query.connectionId as
            | string
            | undefined,

        search:
          req.query.search as
            | string
            | undefined,

        status:
          req.query.status as
            | string
            | undefined,

        page:
          req.query.page
            ? Number(
                req.query.page
              )
            : 1,

        limit:
          req.query.limit
            ? Number(
                req.query.limit
              )
            : 50,
      });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(
      '[CAMPAIGNS] Failed to fetch campaigns:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch campaigns',
    });
  }
}

export async function getCampaign(
  req: Request,
  res: Response
) {
  try {
    const result =
      await getCampaignById(
        req.params.campaignId
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const status =
      error.message ===
      'Campaign not found'
        ? 404
        : 400;

    return res.status(status).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch campaign',
    });
  }
}

export async function campaignStats(
  req: Request,
  res: Response
) {
  try {
    const stats =
      await getCampaignStats(
        req.params.campaignId
      );

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch campaign statistics',
    });
  }
}

export async function campaignEvents(
  req: Request,
  res: Response
) {
  try {
    const result =
      await getCampaignEvents(
        req.params.campaignId,
        {
          page:
            req.query.page
              ? Number(
                  req.query.page
                )
              : 1,

          limit:
            req.query.limit
              ? Number(
                  req.query.limit
                )
              : 50,

          status:
            req.query.status as
              | string
              | undefined,
        }
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Failed to fetch campaign events',
    });
  }
}