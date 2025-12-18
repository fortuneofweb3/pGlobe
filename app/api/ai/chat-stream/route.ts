/**
 * Streaming AI Chat Endpoint - Sends status updates via Server-Sent Events
 * 
 * This endpoint wraps the main /api/ai/chat endpoint and provides real-time
 * status updates to the client while the AI processes the request.
 */

import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message');
  const historyParam = searchParams.get('history');
  const clientIp = searchParams.get('clientIp');

  if (!message) {
    return new Response(
      JSON.stringify({ error: 'Message is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let conversationHistory: any[] = [];
  try {
    if (historyParam) {
      conversationHistory = JSON.parse(historyParam);
    }
  } catch (e) {
    // Ignore parse errors
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      const sendStatus = (status: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`));
          } catch (e) {
            isClosed = true;
          }
        }
      };

      const sendMessage = (message: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`));
            controller.close();
            isClosed = true;
          } catch (e) {
            isClosed = true;
          }
        }
      };

      const sendError = (error: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error })}\n\n`));
            controller.close();
            isClosed = true;
          } catch (e) {
            isClosed = true;
          }
        }
      };

      try {
        // Send initial status
        sendStatus('Thinking...');

        // Show detailed step-by-step status updates
        const messageLower = message.toLowerCase();
        let statusStep = 0;
        
        // Status progression based on common query patterns
        const statusSteps: string[] = [];
        
        if (messageLower.includes('nearest') || messageLower.includes('closest') || messageLower.includes('near me') || messageLower.includes('my location') || messageLower.includes('best node')) {
          statusSteps.push('Getting your location...', 'Finding nearest nodes...', 'Calculating distances...', 'Analyzing node performance...', 'Generating response...');
        } else if (messageLower.includes('credit') && (messageLower.includes('earn') || messageLower.includes('hour') || messageLower.includes('day'))) {
          statusSteps.push('Checking credit changes...', 'Analyzing credit data...', 'Generating response...');
        } else if (messageLower.includes('africa') || messageLower.includes('europe') || messageLower.includes('asia') || messageLower.includes('america')) {
          statusSteps.push('Querying nodes by region...', 'Filtering nodes...', 'Calculating statistics...', 'Generating response...');
        } else if (messageLower.includes('nigeria') || messageLower.includes('france') || messageLower.includes('germany') || messageLower.includes('country')) {
          statusSteps.push('Querying nodes by country...', 'Filtering nodes...', 'Analyzing data...', 'Generating response...');
        } else if (messageLower.includes('ram') || messageLower.includes('cpu') || messageLower.includes('%')) {
          statusSteps.push('Filtering by resource usage...', 'Analyzing performance...', 'Generating response...');
        } else if (messageLower.includes('uptime') || messageLower.includes('average')) {
          statusSteps.push('Calculating statistics...', 'Analyzing data...', 'Generating response...');
        } else if (messageLower.includes('top') || messageLower.includes('best') || messageLower.includes('highest')) {
          statusSteps.push('Finding top performers...', 'Ranking nodes...', 'Analyzing metrics...', 'Generating response...');
        } else if (messageLower.includes('how many') || messageLower.includes('count') || messageLower.includes('total')) {
          statusSteps.push('Counting nodes...', 'Calculating totals...', 'Generating response...');
        } else {
          statusSteps.push('Processing your request...', 'Querying data...', 'Analyzing results...', 'Generating response...');
        }
        
        // Show status steps progressively
        statusSteps.forEach((step, index) => {
          setTimeout(() => {
            if (!isClosed) {
              sendStatus(step);
              statusStep = index;
            }
          }, 1000 + (index * 2000)); // 1s, 3s, 5s, 7s, etc.
        });

        // Call the main chat endpoint
        const baseUrl = request.url.split('/api/ai/chat-stream')[0];
        
        const regularResponse = await fetch(`${baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationHistory, clientIp }),
          signal: AbortSignal.timeout(90000), // 90 second timeout (function calls can take time)
        });

        if (!regularResponse.ok) {
          const errorData = await regularResponse.json().catch(() => ({}));
          sendError(errorData.error || 'Failed to get AI response');
          return;
        }

        const data = await regularResponse.json();
        
        if (!data.message) {
          sendError('Invalid response from AI');
          return;
        }

        // Send the final message
        sendMessage(data.message);
        
      } catch (error: any) {
        console.error('[AI Chat Stream] Error:', error);
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          sendError('Request timed out. Please try again.');
        } else {
          sendError(error?.message || 'Failed to process request');
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
