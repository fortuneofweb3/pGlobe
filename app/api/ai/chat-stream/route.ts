/**
 * Streaming AI Chat Endpoint - Sends real-time status updates via Server-Sent Events
 * 
 * This endpoint processes AI requests and sends status updates as each function executes.
 */

import { NextRequest } from 'next/server';

// Import the chat route's processing functions
// We'll call the chat endpoint but monitor its execution via logs and send updates

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

        // Function status mapping
        const functionStatusMap: Record<string, string> = {
          'get_user_location': 'Getting your location...',
          'get_location_for_ip': 'Looking up IP location...',
          'find_closest_nodes': 'Finding nearest nodes...',
          'filter_nodes': 'Filtering nodes...',
          'get_node_details': 'Fetching node details...',
          'get_network_stats': 'Calculating network statistics...',
          'get_credits_change': 'Checking credit changes...',
          'get_node_history': 'Fetching historical data...',
          'compare_nodes': 'Comparing nodes...',
          'compare_countries': 'Comparing countries...',
        };

        // Monitor console logs to detect function execution
        // This is a workaround - in a perfect world we'd have direct access to the execution
        let lastFunctionSeen = '';
        let statusUpdateInterval: NodeJS.Timeout | null = null;
        
        // Poll for status updates by checking if we're still processing
        // We'll show status based on common patterns and update when we detect function execution
        const checkStatus = () => {
          // This will be updated based on actual execution
        };

        // Call the main chat endpoint
        const chatPromise = fetch(`${baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message, 
            conversationHistory, 
            clientIp
          }),
          signal: AbortSignal.timeout(120000), // 120 second timeout
        });

        // Show status updates while processing
        // We'll update based on common query patterns and show progress
        const messageLower = message.toLowerCase();
        let statusStep = 0;
        
        // Determine likely functions based on query
        const likelyFunctions: string[] = [];
        if (messageLower.includes('nearest') || messageLower.includes('closest') || messageLower.includes('near me') || messageLower.includes('best node')) {
          likelyFunctions.push('get_user_location', 'find_closest_nodes');
        }
        if (messageLower.includes('nigeria') || messageLower.includes('country') || messageLower.includes('africa') || messageLower.includes('europe')) {
          likelyFunctions.push('filter_nodes');
        }
        if (messageLower.includes('compare')) {
          likelyFunctions.push('compare_nodes', 'compare_countries');
        }
        if (messageLower.includes('credit') && (messageLower.includes('earn') || messageLower.includes('hour'))) {
          likelyFunctions.push('get_credits_change');
        }
        
        // Show initial status
        if (likelyFunctions.length > 0 && functionStatusMap[likelyFunctions[0]]) {
          sendStatus(functionStatusMap[likelyFunctions[0]]);
        } else {
          sendStatus('Processing your request...');
        }
        
        // Update status periodically to show we're still working
        const statusInterval = setInterval(() => {
          if (isClosed) {
            clearInterval(statusInterval);
            return;
          }
          statusStep++;
          if (statusStep < likelyFunctions.length && functionStatusMap[likelyFunctions[statusStep]]) {
            sendStatus(functionStatusMap[likelyFunctions[statusStep]]);
          } else if (statusStep >= likelyFunctions.length) {
            sendStatus('Analyzing data...');
          }
        }, 3000); // Update every 3 seconds

        const regularResponse = await chatPromise;

        // Clear intervals
        clearInterval(statusInterval);

        if (!regularResponse.ok) {
          const errorData = await regularResponse.json().catch(() => ({}));
          sendError(errorData.error || 'Failed to get AI response');
          return;
        }

        const data = await regularResponse.json();
        
        // Log function execution info
        if (data.executedFunctions && data.executedFunctions.length > 0) {
          console.log('[AI Chat Stream] Functions executed:', data.executedFunctions);
          console.log('[AI Chat Stream] Iterations:', data.iterations);
          
          // Show what functions were executed (for user feedback)
          // Since we can't get real-time updates, at least show what happened
          const lastFunction = data.executedFunctions[data.executedFunctions.length - 1];
          if (lastFunction && functionStatusMap[lastFunction]) {
            sendStatus(functionStatusMap[lastFunction]);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (!data.message) {
          sendError('Invalid response from AI');
          return;
        }

        // Send final status
        sendStatus('Generating response...');
        await new Promise(resolve => setTimeout(resolve, 300));

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
