/**
 * Public API v1: Webhook subscriptions
 * POST /api/v1/webhooks - Create webhook
 * GET /api/v1/webhooks - List webhooks
 * DELETE /api/v1/webhooks/:id - Delete webhook
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  createdAt: Date;
}

// In-memory webhook store (in production, use database)
const webhooks = new Map<string, Webhook>();

/**
 * Create webhook subscription
 */
export const POST = withAPIAuth(async (request: Request, { apiKey }) => {
  try {
    const body = await request.json();
    const { url, events } = body;

    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: 'URL and events array required' },
        { status: 400 }
      );
    }

    const webhookId = `wh_${Math.random().toString(36).substring(2, 15)}`;
    const secret = `secret_${Math.random().toString(36).substring(2, 32)}`;

    const webhook: Webhook = {
      id: webhookId,
      url,
      events,
      secret,
      enabled: true,
      createdAt: new Date(),
    };

    webhooks.set(webhookId, webhook);

    return NextResponse.json({
      success: true,
      data: {
        id: webhookId,
        url,
        events,
        enabled: true,
        createdAt: webhook.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create webhook' },
      { status: 500 }
    );
  }
});

/**
 * List webhooks for API key
 */
export const GET = withAPIAuth(async (request: Request, { apiKey }) => {
  try {
    // In production, filter by API key
    const userWebhooks = Array.from(webhooks.values()).map(wh => ({
      id: wh.id,
      url: wh.url,
      events: wh.events,
      enabled: wh.enabled,
      createdAt: wh.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: userWebhooks,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to list webhooks' },
      { status: 500 }
    );
  }
});

/**
 * Trigger webhook (internal function)
 */
async function triggerWebhook(event: string, data: any) {
  const matchingWebhooks = Array.from(webhooks.values()).filter(
    wh => wh.enabled && wh.events.includes(event)
  );

  const promises = matchingWebhooks.map(async webhook => {
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Signature': webhook.secret || '',
        },
        body: JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.id}:`, error);
    }
  });

  await Promise.allSettled(promises);
}

