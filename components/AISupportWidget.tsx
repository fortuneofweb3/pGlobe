'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Minimize2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Format message content, detecting and styling pubkeys
function formatMessageWithPubkeys(content: string): JSX.Element[] {
  // Solana pubkey pattern: 32-44 base58 characters (A-Z, a-z, 0-9, excluding 0, O, I, l)
  // Common patterns: "Pubkey: ...", numbered lists (1. XKZpm...), standalone
  const pubkeyPattern = /([A-HJ-NP-Za-km-z1-9]{32,44})/g;
  
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = pubkeyPattern.exec(content)) !== null) {
    // Add text before the pubkey
    if (match.index > lastIndex) {
      const beforeText = content.slice(lastIndex, match.index);
      if (beforeText) {
        parts.push(<span key={`text-${lastIndex}`}>{beforeText}</span>);
      }
    }
    
    // Check if this looks like a pubkey
    // Look at context: should be on its own line or after "Pubkey:", numbered list, etc.
    const beforeChar = match.index > 0 ? content[match.index - 1] : ' ';
    const afterChar = match.index + match[0].length < content.length 
      ? content[match.index + match[0].length] 
      : ' ';
    
    // Check if preceded by "Pubkey:", number + period, or whitespace/newline
    const beforeContext = match.index >= 10 
      ? content.slice(Math.max(0, match.index - 10), match.index).toLowerCase()
      : '';
    const hasPubkeyPrefix = beforeContext.includes('pubkey:');
    const hasNumberPrefix = /^\d+\.\s*$/.test(content.slice(Math.max(0, match.index - 5), match.index));
    
    // Pubkey should be surrounded by whitespace, punctuation, line breaks, or be in a list
    const isPubkey = (hasPubkeyPrefix || hasNumberPrefix || /[\s\n.,:;!?()\[\]{}]/.test(beforeChar)) && 
                     /[\s\n.,:;!?()\[\]{}]/.test(afterChar);
    
    if (isPubkey) {
      // Format as pubkey with monospace and wrap
      parts.push(
        <span key={`pubkey-${match.index}`} className="font-mono text-xs break-all inline-block max-w-full">
          {match[0]}
        </span>
      );
    } else {
      // Not a pubkey, just regular text
      parts.push(<span key={`text-${match.index}`}>{match[0]}</span>);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }
  
  return parts.length > 0 ? parts : [<span key="content">{content}</span>];
}

export default function AISupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI assistant for pGlobe. I can help you understand the network metrics, node statuses, analytics, and how to use the platform. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const [dotCount, setDotCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animate the dots when thinking
  useEffect(() => {
    if (!thinkingStatus) {
      setDotCount(1);
      return;
    }
    
    const interval = setInterval(() => {
      setDotCount(prev => prev >= 3 ? 1 : prev + 1);
    }, 400);
    
    return () => clearInterval(interval);
  }, [thinkingStatus]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');
    setIsLoading(true);
    setThinkingStatus('Thinking...');

    try {
      // Prepare conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Use EventSource for Server-Sent Events to get status updates
      const eventSource = new EventSource(`/api/ai/chat-stream?message=${encodeURIComponent(currentInput)}&history=${encodeURIComponent(JSON.stringify(conversationHistory))}`);

      let finalMessage = '';
      let hasReceivedMessage = false;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.status) {
            // Status update (thinking, querying, etc.)
            setThinkingStatus(data.status);
          } else if (data.message) {
            // Final message
            finalMessage = data.message;
            hasReceivedMessage = true;
            eventSource.close();
          } else if (data.error) {
            // Handle error - show friendly message
            hasReceivedMessage = true;
            eventSource.close();
            
            // Check for rate limit errors
            let errorContent = 'Sorry, I encountered an error. Please try again.';
            if (data.error.includes('quota') || data.error.includes('rate') || data.error.includes('429')) {
              errorContent = 'The AI service is currently busy. Please wait a moment and try again.';
            } else if (data.error.includes('overloaded') || data.error.includes('503')) {
              errorContent = 'The AI service is temporarily overloaded. Please try again in a few seconds.';
            } else if (data.error.includes('timeout')) {
              errorContent = 'The request took too long. Please try a simpler question.';
            }
            
            const errorMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: errorContent,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            setIsLoading(false);
            setThinkingStatus(null);
          }
        } catch (e) {
          console.error('[AI Widget] Error parsing SSE data:', e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (!hasReceivedMessage) {
          // Fallback to regular fetch if SSE fails
          fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: currentInput, conversationHistory }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.message) {
                const assistantMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: data.message,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
              }
            })
            .catch(err => {
              console.error('[AI Widget] Error:', err);
              const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, errorMessage]);
            })
            .finally(() => {
              setIsLoading(false);
              setThinkingStatus(null);
            });
        } else {
          setIsLoading(false);
          setThinkingStatus(null);
        }
      };

      // Wait for final message
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (hasReceivedMessage || eventSource.readyState === EventSource.CLOSED) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        // Timeout after 60 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          eventSource.close();
          resolve();
        }, 60000);
      });

      if (finalMessage) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: finalMessage,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      console.error('[AI Widget] Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error?.message?.includes('Gemini API key') 
          ? 'AI service is not configured. Please check the server configuration.'
          : error?.message || 'Sorry, I encountered an error. Please try again in a moment.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setThinkingStatus(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#F0A741] hover:bg-[#F0A741]/90 text-black shadow-lg hover:shadow-xl flex items-center justify-center group transition-all duration-500 ease-out ${
          isOpen 
            ? 'opacity-0 scale-0 rotate-90 pointer-events-none' 
            : 'opacity-100 scale-100 rotate-0 pointer-events-auto hover:scale-110'
        }`}
        aria-label="Open AI Support"
        style={{
          transformOrigin: 'center',
        }}
      >
        <MessageCircle className={`w-6 h-6 transition-transform duration-300 ${!isOpen ? 'group-hover:scale-110' : ''}`} />
        <span className={`absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-black transition-opacity duration-300 ${isOpen ? 'opacity-0' : 'opacity-100 animate-pulse'}`} />
      </button>

      {/* Chat Widget */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] md:w-[460px] max-w-md bg-black/95 backdrop-blur-md border border-[#F0A741]/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isOpen
            ? isMinimized
              ? 'opacity-100 scale-100 translate-y-0 h-16'
              : 'opacity-100 scale-100 translate-y-0 h-[600px] md:h-[720px] max-h-[calc(100vh-8rem)]'
            : 'opacity-0 scale-75 translate-y-8 pointer-events-none h-[600px] md:h-[720px] max-h-[calc(100vh-8rem)]'
        }`}
        style={{
          transformOrigin: 'bottom right',
        }}
      >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#F0A741]/20 bg-black/50 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F0A741] flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F0A741]">AI Assistant</h3>
                <p className="text-xs text-foreground/60">pGlobe Support</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:bg-[#F0A741]/10 rounded-lg transition-colors"
                aria-label={isMinimized ? 'Expand' : 'Minimize'}
              >
                <Minimize2 className="w-4 h-4 text-foreground/60" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                }}
                className="p-1.5 hover:bg-[#F0A741]/10 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-foreground/60" />
              </button>
            </div>
          </div>

          {/* Messages */}
          {!isMinimized && (
            <>
              <div
                className={`flex-1 overflow-y-auto p-4 space-y-4 transition-all duration-500 ${
                  isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: isOpen ? '200ms' : '0ms' }}
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-[#F0A741]/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-[#F0A741]" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 break-words ${
                        message.role === 'user'
                          ? 'bg-[#F0A741] text-black'
                          : 'bg-[#F0A741]/10 text-foreground border border-[#F0A741]/20'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere word-break-break-word">
                        {formatMessageWithPubkeys(message.content)}
                      </div>
                      <p className="text-xs mt-1 opacity-60">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-[#F0A741]">You</span>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-[#F0A741]/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-[#F0A741]" />
                    </div>
                    <div className="bg-[#F0A741]/10 border border-[#F0A741]/20 rounded-lg px-4 py-2 max-w-[80%]">
                      {thinkingStatus ? (
                        <div className="text-sm text-[#F0A741] font-medium">
                          {thinkingStatus.replace(/\.+$/, '')}{'.'.repeat(dotCount)}
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#F0A741] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[#F0A741] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[#F0A741] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                className={`p-4 border-t border-[#F0A741]/20 bg-black/50 rounded-b-2xl transition-all duration-500 ${
                  isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: isOpen ? '300ms' : '0ms' }}
              >
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about pGlobe..."
                    className="flex-1 px-4 py-2 bg-black/50 border border-[#F0A741]/20 rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#F0A741]/50 text-sm"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className="px-4 py-2 bg-[#F0A741] hover:bg-[#F0A741]/90 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-foreground/40 mt-2 text-center">
                  Ask about nodes, metrics, analytics, or how to use pGlobe
                </p>
              </div>
            </>
          )}
        </div>
    </>
  );
}

