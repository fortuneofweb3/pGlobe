/**
 * Streaming AI Chat Endpoint - Sends real-time status updates via Server-Sent Events
 * 
 * This endpoint processes AI requests and sends status updates as each function executes.
 */

import { NextRequest } from 'next/server';
import {
  DEEPSEEK_API_KEY,
  tools,
  systemPrompt,
  callOpenAICompatible,
  processResponse,
} from '../chat/route';

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
    console.error('[AI Chat Stream] DEEPSEEK_API_KEY not found');
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
            // Strip markdown formatting from the message
            let cleanMessage = message
              .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold **text**
              .replace(/\*(.*?)\*/g, '$1') // Remove italic *text*
              .replace(/#{1,6}\s+/g, '') // Remove headers # ## ###
              .replace(/^-\s+/gm, '') // Remove bullet points at start of lines
              .replace(/^\d+\.\s+/gm, '') // Remove numbered lists
              .trim();
            
            const messageData = `data: ${JSON.stringify({ message: cleanMessage })}\n\n`;
            controller.enqueue(encoder.encode(messageData));
            console.log('[AI Chat Stream] Message enqueued, length:', cleanMessage.length);
          } catch (e) {
            console.error('[AI Chat Stream] Error sending message:', e);
            isClosed = true;
          }
        } else {
          console.error('[AI Chat Stream] Attempted to send message but stream is already closed');
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
        console.log('[AI Chat Stream] Starting request processing');
        console.log('[AI Chat Stream] Message:', message);
        console.log('[AI Chat Stream] Client IP:', clientIp);
        
        // Send initial status
        sendStatus('Thinking...');

        // Build messages array
        const messages: any[] = [
          { role: 'system', content: systemPrompt }
        ];

        // Add conversation history
        if (conversationHistory && Array.isArray(conversationHistory)) {
          conversationHistory.forEach((msg: { role: string; content: string }) => {
            if (msg.role === 'user' || msg.role === 'assistant') {
              messages.push({
                role: msg.role,
                content: msg.content
              });
            }
          });
        }

        // Add current message
        messages.push({ role: 'user', content: message });

        // Use DeepSeek chat model first (faster), fall back to reasoner if needed
        // Reasoner is slower but better for complex reasoning - use chat for speed
        const models = ['deepseek-chat', 'deepseek-reasoner'];
        let maxIterations = 5;
        let iteration = 0;
        let finalResponse = '';
        const allExecutedFunctions: string[] = [];
        
        while (iteration < maxIterations) {
          iteration++;
          console.log(`[DeepSeek] Iteration ${iteration}, messages: ${messages.length}`);

          let response: Response | null = null;
          let lastError: any = null;

          // Try each model with tools and system prompt
          for (const model of models) {
            try {
              console.log(`[DeepSeek] Trying model: ${model}`);
              
              const result = await callOpenAICompatible(
                'https://api.deepseek.com/v1/chat/completions',
                DEEPSEEK_API_KEY!,
                model,
                messages,
                'DeepSeek',
                true // with tools
              );
              
              if (result.success && result.response) {
                response = result.response;
                console.log(`[DeepSeek] Success with model: ${model}`);
                break;
              } else {
                lastError = result.error;
                console.error(`[DeepSeek] Model ${model} failed:`, JSON.stringify(result.error, null, 2));
              }
            } catch (error: any) {
              console.error(`[DeepSeek] Model ${model} exception:`, error?.message, error?.stack);
              lastError = error;
            }
          }

          if (!response) {
            const errorDetails = lastError?.data || lastError?.message || JSON.stringify(lastError);
            console.error('[DeepSeek] All models failed. Last error:', errorDetails);
            sendError('Failed to get AI response from DeepSeek');
            return;
          }

          let data: any;
          try {
            data = await response.json();
            console.log('[AI Chat Stream] Response data structure:', {
              hasChoices: !!data.choices,
              choicesLength: data.choices?.length,
              firstChoice: data.choices?.[0] ? {
                hasMessage: !!data.choices[0].message,
                hasToolCalls: !!data.choices[0].message?.tool_calls,
                hasContent: !!data.choices[0].message?.content,
                toolCallsLength: data.choices[0].message?.tool_calls?.length
              } : null
            });
          } catch (parseError: any) {
            console.error('[AI Chat Stream] Failed to parse response:', parseError);
            sendError('Failed to parse AI response');
            return;
          }
          
          // Status update callback that sends SSE updates
          const statusCallback = (status: string) => {
            if (!isClosed) {
              console.log('[AI Chat Stream] Status update:', status);
              sendStatus(status);
            }
          };
          
          let result;
          try {
            result = await processResponse(data, messages, baseUrl, 'DeepSeek', clientIp || undefined, statusCallback, allExecutedFunctions);
            console.log('[AI Chat Stream] ProcessResponse result:', {
              hasToolCalls: result.hasToolCalls,
              hasFinalResponse: !!result.finalResponse,
              finalResponseLength: result.finalResponse?.length,
              executedFunctions: result.executedFunctions
            });
          } catch (processError: any) {
            console.error('[AI Chat Stream] Error in processResponse:', processError?.message);
            console.error('[AI Chat Stream] Error stack:', processError?.stack);
            sendError(`Processing error: ${processError?.message || 'Unknown error'}`);
            return;
          }
          
          if (result.hasToolCalls) {
            console.log('[AI Chat Stream] Has tool calls, continuing loop');
            messages.length = 0; // Clear array
            messages.push(...result.updatedMessages);
            continue; // Continue loop with updated messages
          }
          
          if (result.finalResponse) {
            console.log('[AI Chat Stream] Got final response, breaking loop');
            finalResponse = result.finalResponse;
            break; // Success!
          }
          
          console.warn('[AI Chat Stream] No tool calls and no final response, continuing loop');
        }

        if (!finalResponse) {
          console.error('[AI Chat Stream] No final response after', iteration, 'iterations');
          console.error('[AI Chat Stream] Executed functions:', allExecutedFunctions);
          sendError('AI did not produce a response after multiple attempts');
          return;
        }

        console.log('[AI Chat Stream] Got final response, length:', finalResponse.length);
        
        // Send final status
        sendStatus('Generating response...');
        
        // Send the final message immediately
        console.log('[AI Chat Stream] Sending final message');
        sendMessage(finalResponse);
        
        // Mark as closed and close the controller after a brief delay to ensure message is sent
        isClosed = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Close the controller (only if not already closed)
        try {
          controller.close();
          console.log('[AI Chat Stream] Stream closed successfully');
        } catch (e: any) {
          // Ignore if already closed
          if (e?.code !== 'ERR_INVALID_STATE') {
            console.log('[AI Chat Stream] Error closing stream:', e);
          }
        }
        
      } catch (error: any) {
        console.error('[AI Chat Stream] Unhandled error:', error);
        console.error('[AI Chat Stream] Error stack:', error?.stack);
        console.error('[AI Chat Stream] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        if (!isClosed) {
          if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            sendError('Request timed out. Please try again.');
          } else {
            sendError(error?.message || 'Failed to process request');
          }
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
