import fetch from 'node-fetch';

export interface DeliveryServerRaw {
  server_id: string;
  type?: string;
  name?: string;
  hostname?: string;
  status?: string;
  [key: string]: unknown;
}

interface MailWizzResponse {
  status?: string;

  data?: {
    records?: DeliveryServerRaw[];
    count?: number | string;
    total_pages?: number;
    current_page?: number;
    next_page?: number | null;
    prev_page?: number | null;
    [key: string]: unknown;
  };

  error?: unknown;

  [key: string]: unknown;
}

export default class MailWizzClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    baseUrl: string,
    apiKey: string
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  /**
   * Headers required by the MailWizz API.
   *
   * MailWizz 2.x/3.x uses the API key through
   * the X-Api-Key header.
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Api-Key': this.apiKey,
    };
  }

  /**
   * Generic GET request.
   */
  private async get<T>(
    path: string
  ): Promise<T> {
    const cleanPath = path.replace(/^\/+/, '');

    const url =
      `${this.baseUrl}/${cleanPath}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const text = await response.text();

    let data: unknown;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `MailWizz returned invalid JSON. HTTP ${response.status}: ${text}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `MailWizz API error ${response.status}: ${JSON.stringify(data)}`
      );
    }

    return data as T;
  }

  /**
   * Get delivery servers from MailWizz.
   */
  async getDeliveryServers(): Promise<DeliveryServerRaw[]> {
    const allRecords: DeliveryServerRaw[] = [];

    let page = 1;

    while (true) {
      const response =
        await this.get<MailWizzResponse>(
          `delivery-servers?page=${page}`
        );

      if (
        response.status !== 'success' ||
        !response.data ||
        !Array.isArray(response.data.records)
      ) {
        break;
      }

      allRecords.push(
        ...response.data.records
      );

      const totalPages =
        Number(response.data.total_pages ?? 1);

      if (page >= totalPages) {
        break;
      }

      page++;
    }

    console.log(
      `MailWizz delivery servers fetched: ${allRecords.length}`
    );

    return allRecords;
  }
}