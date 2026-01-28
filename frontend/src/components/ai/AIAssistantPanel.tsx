import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Sparkles,
  Send,
  Loader2,
  MessageSquare,
  FileText,
  ListChecks,
  KeyRound,
  AlertCircle,
  Info,
  RefreshCw,
  ChevronDown,
  Bot,
  User,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import type { AIMessage, AIStatusResponse } from '@/types';

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
  fileName?: string;
}

type DetailLevel = 'brief' | 'detailed' | 'executive';

export function AIAssistantPanel({
  isOpen,
  onClose,
  fileId,
  fileName,
}: AIAssistantPanelProps) {
  const [status, setStatus] = useState<AIStatusResponse | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);
  const [summaryLevel, setSummaryLevel] = useState<DetailLevel>('detailed');
  const [showSummaryOptions, setShowSummaryOptions] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Check AI status on mount
  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current && !showPrivacyNotice) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, showPrivacyNotice]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current();
      }
    };
  }, []);

  const checkStatus = async () => {
    try {
      const response = await api.getAIStatus();
      setStatus(response);
      if (!response.available) {
        setError('AI service is not available. Please configure an API key.');
      }
    } catch (err) {
      setError('Failed to check AI status');
    }
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !fileId || isLoading || isStreaming) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsStreaming(true);
    setStreamingContent('');

    // Use streaming API
    abortRef.current = api.aiChatStream(
      fileId,
      userMessage.content,
      sessionId || undefined,
      undefined,
      (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      (finalSessionId) => {
        setIsStreaming(false);
        setSessionId(finalSessionId);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: streamingContent,
            timestamp: new Date().toISOString(),
          },
        ]);
        setStreamingContent('');
      },
      (err) => {
        setIsStreaming(false);
        setError(err);
        setStreamingContent('');
      }
    );
  }, [input, fileId, isLoading, isStreaming, sessionId, streamingContent]);

  const handleQuickAction = async (action: 'summarize' | 'key-points' | 'action-items') => {
    if (!fileId || isLoading || isStreaming) return;

    setIsLoading(true);
    setError(null);

    try {
      let result;
      let userPrompt = '';

      switch (action) {
        case 'summarize':
          userPrompt = `Summarize this document (${summaryLevel} level)`;
          result = await api.aiSummarize(fileId, summaryLevel);
          break;
        case 'key-points':
          userPrompt = 'Extract key points from this document';
          result = await api.aiKeyPoints(fileId);
          break;
        case 'action-items':
          userPrompt = 'Extract action items from this document';
          result = await api.aiActionItems(fileId);
          break;
      }

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: userPrompt,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Add assistant response
      const content = 'summary' in result ? result.summary : result.data;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
          metadata: {
            model: result.model,
            tokens_used: result.tokens_used,
          },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setStreamingContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const acceptPrivacy = () => {
    setShowPrivacyNotice(false);
    localStorage.setItem('ai-privacy-accepted', 'true');
  };

  // Check if privacy was already accepted
  useEffect(() => {
    const accepted = localStorage.getItem('ai-privacy-accepted');
    if (accepted === 'true') {
      setShowPrivacyNotice(false);
    }
  }, []);

  const renderPrivacyNotice = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Info className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">AI Assistant Privacy Notice</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {status?.privacy_notice ||
          'Your document content will be sent to an AI service for processing. No data is stored permanently.'}
      </p>
      <div className="space-y-2 text-xs text-muted-foreground mb-6">
        <p>• Document text is sent to process your requests</p>
        <p>• Conversations are not saved after you close the panel</p>
        <p>• You can clear the chat at any time</p>
      </div>
      <Button onClick={acceptPrivacy} className="gap-2">
        <Sparkles className="w-4 h-4" />
        I Understand, Continue
      </Button>
    </div>
  );

  const renderNoDocument = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Document Loaded</h3>
      <p className="text-sm text-muted-foreground">
        Upload a PDF document to start using the AI assistant.
      </p>
    </div>
  );

  const renderUnavailable = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">AI Not Available</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Configure ANTHROPIC_API_KEY or OPENAI_API_KEY to enable AI features.
      </p>
      <Button variant="outline" onClick={checkStatus} className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Retry
      </Button>
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Quick Actions */}
      <div className="p-2 sm:p-3 border-b">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 sm:gap-1.5 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => setShowSummaryOptions(!showSummaryOptions)}
              disabled={isLoading || isStreaming}
            >
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">Summarize</span>
              <span className="xs:hidden">Sum</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
            {showSummaryOptions && (
              <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-md z-10 min-w-[120px] sm:min-w-[140px]">
                {(['brief', 'detailed', 'executive'] as DetailLevel[]).map((level) => (
                  <button
                    key={level}
                    className={cn(
                      'w-full px-3 py-2 text-xs sm:text-sm text-left hover:bg-accent capitalize',
                      summaryLevel === level && 'bg-accent'
                    )}
                    onClick={() => {
                      setSummaryLevel(level);
                      setShowSummaryOptions(false);
                      handleQuickAction('summarize');
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-1.5 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
            onClick={() => handleQuickAction('key-points')}
            disabled={isLoading || isStreaming}
          >
            <KeyRound className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Key Points</span>
            <span className="xs:hidden">Key</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-1.5 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
            onClick={() => handleQuickAction('action-items')}
            disabled={isLoading || isStreaming}
          >
            <ListChecks className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline">Actions</span>
            <span className="xs:hidden">Act</span>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollRef}>
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 sm:py-8 px-2">
            <Bot className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/50 mb-2 sm:mb-3" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Ask me anything about "{fileName || 'your document'}"
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-1">
              Or use the quick actions above
            </p>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'flex gap-2 sm:gap-3',
                message.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.role === 'user' ? (
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </div>
              <div
                className={cn(
                  'flex-1 max-w-[88%] sm:max-w-[85%] rounded-lg px-2.5 sm:px-3 py-2',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{message.content}</p>
                {message.role === 'assistant' && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[60%]">
                      {message.metadata?.model || 'AI'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleCopy(message.content, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="flex gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="flex-1 max-w-[88%] sm:max-w-[85%] bg-muted rounded-lg px-2.5 sm:px-3 py-2">
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{streamingContent}</p>
                <span className="inline-block w-1.5 h-3 sm:w-2 sm:h-4 bg-foreground/50 animate-pulse ml-0.5" />
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {(isLoading || (isStreaming && !streamingContent)) && (
            <div className="flex gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="bg-muted rounded-lg px-2.5 sm:px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="px-3 sm:px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-[10px] sm:text-xs text-destructive flex items-center gap-1.5 sm:gap-2">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span className="line-clamp-2">{error}</span>
          </p>
        </div>
      )}

      {/* Input */}
      <div className="p-2 sm:p-3 border-t safe-area-bottom">
        <div className="flex gap-1.5 sm:gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this document..."
            disabled={isLoading || isStreaming}
            className="flex-1 h-9 sm:h-10 text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isStreaming}
            size="icon"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            {isLoading || isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1.5 sm:mt-2">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {status?.active_provider?.name || 'AI'} <span className="hidden xs:inline">• Enter to send</span>
          </p>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] sm:text-xs px-2"
              onClick={handleNewChat}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              <span className="hidden xs:inline">New Chat</span>
              <span className="xs:hidden">New</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <SheetContent className="w-full sm:w-[400px] md:w-[450px] p-0 flex flex-col max-w-full">
        <SheetHeader className="px-3 sm:px-4 py-2.5 sm:py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Assistant
          </SheetTitle>
          <SheetDescription className="text-[11px] sm:text-xs truncate">
            {fileName ? `Analyzing: ${fileName}` : 'Chat with your documents'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {!fileId ? (
            renderNoDocument()
          ) : status && !status.available ? (
            renderUnavailable()
          ) : showPrivacyNotice ? (
            renderPrivacyNotice()
          ) : (
            renderChat()
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
