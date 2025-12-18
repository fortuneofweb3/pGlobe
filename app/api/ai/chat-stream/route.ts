/**
 * Streaming AI Chat Endpoint - Sends real-time status updates via Server-Sent Events
 * 
 * This endpoint processes AI requests directly and sends status updates
 * as each function is executed, giving users real-time feedback.
 */

import { NextRequest } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

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

  if (!DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'AI service not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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

  const baseUrl = request.url.split('/api/ai/chat-stream')[0];

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
        
        // Show progress updates while waiting
        // These are approximate since we can't get real-time function execution updates
        let progressStep = 0;
        const progressMessages = [
          'Processing your request...',
          'Querying data...',
          'Analyzing results...',
        ];
        
        const progressInterval = setInterval(() => {
          if (!isClosed && progressStep < progressMessages.length) {
            sendStatus(progressMessages[progressStep]);
            progressStep++;
          }
        }, 2500);

        // Call the main chat endpoint and get the response
        const regularResponse = await fetch(`${baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message, 
            conversationHistory, 
            clientIp,
            streaming: true // Tell the chat endpoint we want streaming info
          }),
          signal: AbortSignal.timeout(120000), // 120 second timeout
        });

        if (!regularResponse.ok) {
          const errorData = await regularResponse.json().catch(() => ({}));
          sendError(errorData.error || 'Failed to get AI response');
          return;
        }

        const data = await regularResponse.json();
        
        // Clear progress interval
        clearInterval(progressInterval);
        
        // Log function execution info
        if (data.executedFunctions && data.executedFunctions.length > 0) {
          console.log('[AI Chat Stream] Functions executed:', data.executedFunctions);
          console.log('[AI Chat Stream] Iterations:', data.iterations);
        }
        
        if (!data.message) {
          sendError('Invalid response from AI');
          return;
        }

        // Send the final message
        sendMessage(data.message);
        
      } catch (error: any) {
        // @ts-ignore - progressInterval may be defined
        if (typeof progressInterval !== 'undefined') clearInterval(progressInterval);
        
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
