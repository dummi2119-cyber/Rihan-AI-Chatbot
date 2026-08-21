import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHealthCheck, useSendChatMessage } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  History,
  Menu,
  MessageCircle,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';

const queryClient = new QueryClient();

function Home() {
  type Language = 'en' | 'hi';
  type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: number;
  };
  type Conversation = {
    id: string;
    title: string;
    updatedAt: number;
    messages: ChatMessage[];
  };

  const copy = useMemo(
    () => ({
      en: {
        newChat: 'New conversation',
        history: 'Your conversations',
        historyHint: 'A quiet place for your thoughts.',
        greeting: 'Namaste, I’m Rihan.',
        subGreeting: 'What would you like to explore today?',
        intro: 'A thoughtful assistant for the questions between Hindi and English.',
        placeholder: 'Ask Rihan anything...',
        sendHint: 'Press Enter to send · Shift + Enter for a new line',
        online: 'Rihan is ready',
        connecting: 'Checking connection',
        offline: 'Connection unavailable',
        emptyHistory: 'Your conversations will appear here.',
        clear: 'Clear conversation',
        copy: 'Copy response',
        copied: 'Copied',
        thinking: 'Rihan is thinking',
        errorTitle: 'That did not reach Rihan',
        retry: 'Try again',
        language: 'Language',
        english: 'English',
        hindi: 'हिन्दी',
        suggestions: [
          ['Understand a concept', 'Explain something clearly'],
          ['Write with me', 'Shape an idea or draft'],
          ['Switch languages', 'हिंदी में बात करें'],
        ],
      },
      hi: {
        newChat: 'नई बातचीत',
        history: 'आपकी बातचीत',
        historyHint: 'आपके विचारों के लिए एक शांत जगह।',
        greeting: 'नमस्ते, मैं रिहान हूँ।',
        subGreeting: 'आज आप क्या जानना चाहेंगे?',
        intro: 'हिंदी और अंग्रेज़ी के बीच आपके सवालों का समझदार साथी।',
        placeholder: 'रिहान से कुछ भी पूछें...',
        sendHint: 'भेजने के लिए Enter · नई पंक्ति के लिए Shift + Enter',
        online: 'रिहान तैयार है',
        connecting: 'कनेक्शन जाँच रहे हैं',
        offline: 'कनेक्शन उपलब्ध नहीं',
        emptyHistory: 'आपकी बातचीत यहाँ दिखाई देगी।',
        clear: 'बातचीत साफ़ करें',
        copy: 'उत्तर कॉपी करें',
        copied: 'कॉपी हो गया',
        thinking: 'रिहान सोच रहा है',
        errorTitle: 'रिहान तक संदेश नहीं पहुँचा',
        retry: 'फिर कोशिश करें',
        language: 'भाषा',
        english: 'English',
        hindi: 'हिन्दी',
        suggestions: [
          ['किसी विषय को समझें', 'कुछ आसान भाषा में समझाएँ'],
          ['मेरे साथ लिखें', 'किसी विचार या ड्राफ्ट पर काम करें'],
          ['भाषा बदलें', 'Talk in English'],
        ],
      },
    }),
    [],
  );

  const [language, setLanguage] = useState<Language>('en');
  const [histories, setHistories] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSubmittedRef = useRef('');
  const health = useHealthCheck();
  const sendMessage = useSendChatMessage();
  const t = copy[language];

  useEffect(() => {
    document.documentElement.classList.add('dark');
    const savedLanguage = window.localStorage.getItem('rihan-language') as Language | null;
    if (savedLanguage === 'en' || savedLanguage === 'hi') setLanguage(savedLanguage);
    try {
      const saved = JSON.parse(window.localStorage.getItem('rihan-conversations') || '[]') as Conversation[];
      if (Array.isArray(saved)) {
        setHistories(saved);
        if (saved[0]) {
          setActiveId(saved[0].id);
          setMessages(saved[0].messages);
        }
      }
    } catch {
      setHistories([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('rihan-language', language);
  }, [language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sendMessage.isPending]);

  const persistConversation = (conversation: Conversation) => {
    setHistories((current) => {
      const next = [conversation, ...current.filter((item) => item.id !== conversation.id)]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 24);
      window.localStorage.setItem('rihan-conversations', JSON.stringify(next));
      return next;
    });
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setDraft('');
    setErrorMessage('');
    sendMessage.reset();
    setSidebarOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 80);
  };

  const openConversation = (conversation: Conversation) => {
    setActiveId(conversation.id);
    setMessages(conversation.messages);
    setDraft('');
    setErrorMessage('');
    sendMessage.reset();
    setSidebarOpen(false);
  };

  const clearConversation = () => {
    if (!activeId) return;
    setHistories((current) => {
      const next = current.filter((item) => item.id !== activeId);
      window.localStorage.setItem('rihan-conversations', JSON.stringify(next));
      return next;
    });
    startNewChat();
  };

  const submitMessage = (content = draft, baseMessages = messages) => {
    const trimmed = content.trim();
    if (!trimmed || sendMessage.isPending) return;
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };
    const nextMessages = [...baseMessages, userMessage];
    const conversationId = activeId || `conversation-${Date.now()}`;
    lastSubmittedRef.current = trimmed;
    setActiveId(conversationId);
    setMessages(nextMessages);
    setDraft('');
    setErrorMessage('');
    sendMessage.reset();
    const historyItem: Conversation = {
      id: conversationId,
      title: trimmed.length > 34 ? `${trimmed.slice(0, 34)}…` : trimmed,
      updatedAt: Date.now(),
      messages: nextMessages,
    };
    persistConversation(historyItem);
    sendMessage.mutate(
      {
        data: {
          messages: nextMessages.slice(-50).map(({ role, content }) => ({ role, content })),
        },
      },
      {
        onSuccess: (response) => {
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.message.content,
            createdAt: Date.now(),
          };
          const completedMessages = [...nextMessages, assistantMessage];
          setMessages(completedMessages);
          persistConversation({
            ...historyItem,
            updatedAt: Date.now(),
            messages: completedMessages,
          });
        },
        onError: (error) => {
          const possibleError = error as { error?: string; message?: string };
          setErrorMessage(possibleError.error || possibleError.message || t.errorTitle);
        },
      },
    );
  };

  const retryLast = () => {
    const failedUserMessage = messages[messages.length - 1];
    const baseMessages =
      failedUserMessage?.role === 'user' && failedUserMessage.content === lastSubmittedRef.current
        ? messages.slice(0, -1)
        : messages;
    setMessages(baseMessages);
    submitMessage(lastSubmittedRef.current, baseMessages);
  };

  const copyResponse = async (message: ChatMessage) => {
    await navigator.clipboard?.writeText(message.content);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const formatTime = (timestamp: number) =>
    new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(timestamp);

  const isOnline = health.data?.status === 'ok' || health.data?.status === 'healthy';
  const isHealthLoading = health.isLoading;

  return (
    <div className="rihan-shell min-h-[100dvh] text-foreground">
      <div className="rihan-grain" aria-hidden="true" />
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-[hsl(246_40%_3%/0.68)] md:hidden"
          aria-label="Close conversation history"
          data-testid="button-close-history-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[284px] flex-col border-r border-sidebar-border bg-sidebar/95 px-4 py-5 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'md:w-[76px] md:px-3' : ''}`}
        aria-label="Conversation history"
      >
        <div className={`mb-8 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            className="group flex items-center gap-3 text-left"
            onClick={startNewChat}
            data-testid="button-brand-new-chat"
            aria-label="Start a new conversation"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-[0_8px_28px_hsl(39_94%_61%/0.18)] transition-transform duration-300 group-hover:-rotate-6">
              <span className="font-display text-[19px] font-extrabold tracking-[-0.08em]">R</span>
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />
            </span>
            {!sidebarCollapsed && (
              <span>
                <span className="font-display block text-[17px] font-bold tracking-[-0.03em] text-sidebar-foreground">rihan</span>
                <span className="font-mono-ui block text-[9px] uppercase tracking-[0.18em] text-muted-foreground">AI companion</span>
              </span>
            )}
          </button>
          <button
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:block"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? 'Expand history' : 'Collapse history'}
            data-testid="button-toggle-history"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close history"
            data-testid="button-close-history"
          >
            <X size={17} />
          </button>
        </div>

        <button
          className={`group mb-7 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 py-3 text-sm font-semibold text-primary transition-all duration-200 hover:border-primary/50 hover:bg-primary/[0.12] ${
            sidebarCollapsed ? 'justify-center px-0' : ''
          }`}
          onClick={startNewChat}
          data-testid="button-new-chat"
        >
          <Plus size={17} className="transition-transform duration-200 group-hover:rotate-90" />
          {!sidebarCollapsed && <span>{t.newChat}</span>}
        </button>

        {!sidebarCollapsed && (
          <>
            <div className="mb-3 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <History size={13} />
              <span>{t.history}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {histories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-sidebar-border px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                  {t.emptyHistory}
                </div>
              ) : (
                histories.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                      activeId === conversation.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                    }`}
                    onClick={() => openConversation(conversation)}
                    data-testid={`button-conversation-${conversation.id}`}
                  >
                    <MessageCircle size={15} className={`mt-0.5 shrink-0 ${activeId === conversation.id ? 'text-primary' : ''}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{conversation.title}</span>
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock3 size={10} />
                        {formatTime(conversation.updatedAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <p className="mt-5 px-2 text-[11px] leading-relaxed text-muted-foreground">{t.historyHint}</p>
          </>
        )}

        <div className={`mt-5 border-t border-sidebar-border pt-4 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between rounded-xl bg-sidebar-accent/50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-accent' : 'bg-primary'}`} />
                {isHealthLoading ? t.connecting : isOnline ? t.online : t.offline}
              </span>
              <span className="font-mono-ui text-[9px] text-muted-foreground">v1.0</span>
            </div>
          )}
          {sidebarCollapsed && <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-accent' : 'bg-primary'}`} title={isOnline ? t.online : t.offline} />}
        </div>
      </aside>

      <main className={`flex min-h-[100dvh] flex-col transition-[padding] duration-300 ${sidebarCollapsed ? 'md:pl-[76px]' : 'md:pl-[284px]'}`}>
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border/70 px-5 md:px-10">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-border bg-card/70 p-2.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open conversation history"
              data-testid="button-open-history"
            >
              <Menu size={18} />
            </button>
            <div>
              <p className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-primary/80">Rihan AI</p>
              <h2 className="mt-0.5 text-sm font-semibold text-foreground">
                {activeId ? histories.find((item) => item.id === activeId)?.title || t.newChat : t.newChat}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-border bg-card/50 p-1" aria-label={t.language}>
              <button
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${language === 'en' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setLanguage('en')}
                data-testid="button-language-english"
              >
                EN
              </button>
              <button
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${language === 'hi' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setLanguage('hi')}
                data-testid="button-language-hindi"
              >
                हिं
              </button>
            </div>
            {activeId && (
              <button
                className="rounded-xl border border-border bg-card/50 p-2.5 text-muted-foreground transition-colors hover:border-destructive/45 hover:text-destructive"
                onClick={clearConversation}
                aria-label={t.clear}
                title={t.clear}
                data-testid="button-clear-conversation"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[920px] flex-col px-5 pb-8 pt-10 md:px-10 md:pt-14">
            {messages.length === 0 ? (
              <section className="flex flex-1 flex-col justify-center pb-12 md:pb-24">
                <div className="entry mb-10">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.08] text-primary">
                    <Sparkles size={21} strokeWidth={1.8} />
                  </div>
                  <h1 className="font-display max-w-[680px] text-[clamp(2.35rem,6vw,4.8rem)] font-extrabold leading-[0.96] tracking-[-0.065em] text-foreground">
                    {t.greeting}
                  </h1>
                  <p className="mt-5 max-w-[540px] text-[clamp(1.05rem,2vw,1.3rem)] leading-relaxed text-muted-foreground">
                    {t.subGreeting}
                  </p>
                  <p className="mt-3 max-w-[470px] text-sm leading-relaxed text-muted-foreground/75">{t.intro}</p>
                </div>
                <div className="grid max-w-[720px] grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {t.suggestions.map(([title, subtitle], index) => (
                    <button
                      key={title}
                      className={`entry entry-delay-${index + 1} group rounded-2xl border border-border bg-card/60 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card`}
                      onClick={() => {
                        setDraft(index === 2 && language === 'en' ? 'Can we continue in Hindi?' : title);
                        textareaRef.current?.focus();
                      }}
                      data-testid={`button-suggestion-${index}`}
                    >
                      <span className="mb-8 block text-sm font-semibold text-foreground transition-colors group-hover:text-primary">{title}</span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">{subtitle}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="space-y-8">
                {messages.map((message, index) => (
                  <article key={message.id} className={`entry flex gap-3.5 md:gap-4 ${message.role === 'user' ? 'justify-end' : ''}`} data-testid={`message-${message.role}-${index}`}>
                    {message.role === 'assistant' && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-primary text-primary-foreground">
                        <span className="font-display text-sm font-extrabold tracking-[-0.08em]">R</span>
                      </div>
                    )}
                    <div className={`max-w-[88%] md:max-w-[76%] ${message.role === 'user' ? 'items-end' : ''}`}>
                      <div className={`message-copy rounded-2xl px-4 py-3.5 text-[15px] leading-[1.65] ${
                        message.role === 'user'
                          ? 'rounded-br-md bg-primary text-primary-foreground'
                          : 'rounded-tl-md border border-border/80 bg-card/75 text-foreground'
                      }`} data-testid={`text-message-content-${index}`}>
                        {message.content}
                      </div>
                      <div className={`mt-2 flex items-center gap-2 text-[10px] text-muted-foreground ${message.role === 'user' ? 'justify-end' : ''}`}>
                        <span>{formatTime(message.createdAt)}</span>
                        {message.role === 'assistant' && (
                          <button
                            className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-secondary hover:text-foreground"
                            onClick={() => copyResponse(message)}
                            aria-label={copiedId === message.id ? t.copied : t.copy}
                            data-testid={`button-copy-response-${index}`}
                          >
                            {copiedId === message.id ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copiedId === message.id ? t.copied : t.copy}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                {sendMessage.isPending && (
                  <div className="entry flex gap-3.5 md:gap-4" data-testid="status-thinking">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-primary text-primary-foreground">
                      <span className="font-display text-sm font-extrabold tracking-[-0.08em]">R</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border/80 bg-card/75 px-4 py-4">
                      <span className="text-xs text-muted-foreground">{t.thinking}</span>
                      <span className="flex gap-1">
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                    </div>
                  </div>
                )}
                {errorMessage && (
                  <div className="entry flex items-start gap-3 rounded-2xl border border-destructive/35 bg-destructive/[0.08] px-4 py-3.5" role="alert" data-testid="status-chat-error">
                    <Wifi size={16} className="mt-0.5 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{t.errorTitle}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{errorMessage}</p>
                    </div>
                    <button
                      className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                      onClick={retryLast}
                      data-testid="button-retry-message"
                    >
                      <RefreshCw size={13} />
                      {t.retry}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[920px] px-5 pb-5 pt-2 md:px-10 md:pb-8">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage();
            }}
            className="entry-delay-2"
          >
            <div className="composer-glow relative rounded-[20px] border border-border bg-card/85 p-2 transition-all duration-300">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                rows={1}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                data-testid="input-chat-message"
                className="max-h-40 min-h-[48px] w-full resize-none border-0 bg-transparent px-3 py-3 pr-14 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sendMessage.isPending}
                className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary text-primary-foreground transition-all duration-200 hover:scale-105 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
                aria-label="Send message"
                data-testid="button-send-message"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-[10px] text-muted-foreground/65">{t.sendHint}</p>
              <p className="font-mono-ui text-[9px] uppercase tracking-[0.13em] text-muted-foreground/45">Private by default</p>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
