import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Database,
  AlertCircle,
  ArrowRight,
  History,
  Plus,
  Trash2,
  X,
  Clock,
  MessageSquare,
  Copy,
  Check,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import api from '../lib/api';
import MarkdownRenderer from '../components/ai/MarkdownRenderer';
import { formatISTDateTime } from '../lib/dateUtils';

interface DatasetOption {
  id: string;
  name: string;
  source_type: string;
  version: number;
  stage: string;
  rows: number | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  datasetName?: string;
  modelName?: string;
}

interface ConversationItem {
  id: string;
  dataset_id?: string;
  dataset_name?: string;
  persona: string;
  mode: string;
  message_count: number;
  last_message_preview?: string;
  created_at: string;
}

export default function AIChatPage() {
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [persona, setPersona] = useState<'executive' | 'analyst' | 'technical'>('analyst');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<{ provider: string; model: string; has_api_key: boolean; status: string } | null>(null);

  // ── Custom API Key State ──────────────────────────────────────────
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('custom_gemini_api_key') || '');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── Conversation History State ──────────────────────────────────────
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<ConversationItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Load active AI Engine Configuration
  useEffect(() => {
    const fetchAiConfig = async () => {
      try {
        const { data } = await api.get('/ai/config');
        if (data) {
          setAiConfig(data);
        }
      } catch (err) {
        console.error('Failed to load AI config:', err);
      }
    };
    fetchAiConfig();
  }, []);

  // Load user's uploaded datasets
  useEffect(() => {
    const fetchDatasets = async () => {
      setIsLoadingDatasets(true);
      try {
        const { data } = await api.get('/datasets');
        if (data && data.items && data.items.length > 0) {
          const list: DatasetOption[] = data.items.map((d: any) => ({
            id: d.id,
            name: d.name,
            source_type: d.source_type || 'csv',
            version: d.latest_version?.version_number || 1,
            stage: d.latest_version?.stage || 'raw',
            rows: d.latest_version?.row_count || null,
          }));
          setDatasets(list);
          setSelectedDatasetId(list[0].id);
        } else {
          setDatasets([]);
        }
      } catch (err) {
        console.error('Failed to load user datasets for AI chat:', err);
      } finally {
        setIsLoadingDatasets(false);
      }
    };
    fetchDatasets();
  }, []);

  // Fetch past conversation list
  const fetchConversations = async () => {
    setIsLoadingHistory(true);
    try {
      const { data } = await api.get('/ai/conversations');
      if (Array.isArray(data)) {
        setHistoryList(data);
      }
    } catch (err) {
      console.error('Failed to fetch conversation history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    setIsHistoryOpen(true);
    fetchConversations();
  };

  // Load an existing conversation and continue it
  const handleSelectConversation = async (convId: string) => {
    try {
      const { data } = await api.get(`/ai/conversations/${convId}`);
      if (data) {
        setConversationId(data.id);
        if (data.dataset_id) {
          setSelectedDatasetId(data.dataset_id);
        }
        if (data.persona && ['executive', 'analyst', 'technical'].includes(data.persona)) {
          setPersona(data.persona as any);
        }

        const loadedMsgs: Message[] = (data.messages || []).map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        setMessages(loadedMsgs);
        setIsHistoryOpen(false);
      }
    } catch (err) {
      console.error('Failed to load past conversation:', err);
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/ai/conversations/${convId}`);
      setHistoryList((prev) => prev.filter((item) => item.id !== convId));
      if (conversationId === convId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Reset to New Chat Session
  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setInput('');
    setIsHistoryOpen(false);
  };

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  const handleTestApiKey = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const keyToTest = customApiKey.trim() || undefined;
      const { data } = await api.post('/ai/test-key', { api_key: keyToTest });
      if (data.success) {
        setTestResult({ success: true, message: data.message || 'Connected to Google Gemini successfully!' });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || err.message || 'Failed to connect to AI engine',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSaveApiKey = (newKey: string) => {
    setCustomApiKey(newKey);
    if (newKey.trim()) {
      localStorage.setItem('custom_gemini_api_key', newKey.trim());
    } else {
      localStorage.removeItem('custom_gemini_api_key');
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const queryText = (customPrompt || input).trim();
    if (!queryText || isStreaming) return;

    if (!selectedDataset) {
      alert('Please upload and select a dataset to ask questions and run data analysis.');
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
      datasetName: selectedDataset.name,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const placeholderAssistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      datasetName: selectedDataset.name,
    };
    setMessages((prev) => [...prev, placeholderAssistantMsg]);

    const activeApiKey = customApiKey.trim() || undefined;

    try {
      const { data } = await api.post('/ai/dataset-chat', {
        dataset_id: selectedDataset.id,
        prompt: queryText,
        persona: persona,
        conversation_id: conversationId || undefined,
        api_key: activeApiKey,
      });

      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const returnedModel = data.model || 'gemini-3.6-flash';
      const fullResponse = data.content || 'Analysis complete.';

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: fullResponse, modelName: returnedModel }
            : m
        )
      );
      setIsStreaming(false);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail ||
        'Failed to query dataset analysis. Please ensure the dataset file is reachable.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `⚠️ **Analysis Error**: ${errorMsg}` }
            : m
        )
      );
      setIsStreaming(false);
    }
  };

  const suggestedQuestions = selectedDataset
    ? [
        `📊 Analyze distribution patterns, feature correlations, and key drivers in ${selectedDataset.name}`,
        `🔮 Project predictive trends, calculate regression slopes, and forecast future outcomes`,
        `📋 Generate a data quality assessment, outlier diagnosis, and executive findings`,
      ]
    : [
        '📊 Analyze distribution patterns, feature correlations, and key drivers',
        '🔮 Project predictive trends, calculate regression slopes, and forecast future outcomes',
        '📋 Generate a data quality assessment, outlier diagnosis, and executive findings',
      ];

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 3.25rem)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.45rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              AI Data Intelligence
            </h1>
            <span
              style={{
                fontSize: '0.6875rem',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--color-primary)',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              Dataset Scoped
            </span>
            <span
              style={{
                fontSize: '0.6875rem',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--color-success)',
                padding: '0.15rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <Sparkles size={11} />
              <span>
                {aiConfig?.provider === 'gemini'
                  ? `Google Gemini (${aiConfig?.model || 'gemini-3.6-flash'}) · Live Connected`
                  : 'AI Engine Connected'}
              </span>
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.15rem', margin: 0 }}>
            Specialized analytical Q&amp;A, root-cause investigation &amp; predictive insights on your selected data
          </p>
        </div>

        {/* Right Toolbar: Persona Selector & History Actions */}
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Persona Toggle */}
          <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 2, border: '1px solid var(--border-subtle)' }}>
            {(['executive', 'analyst', 'technical'] as const).map((p) => (
              <button
                key={p}
                className={`btn ${persona === p ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => setPersona(p)}
                style={{ textTransform: 'capitalize', fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
                title={`Switch to ${p} perspective`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* AI Key Settings Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsKeyModalOpen(true)}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '0.3rem' }}
            title="Configure Google Gemini API Key"
            id="btn-ai-key"
          >
            <Key size={14} style={{ color: (customApiKey || aiConfig?.has_api_key) ? 'var(--color-success)' : 'var(--color-warning)' }} />
            <span>{(customApiKey || aiConfig?.has_api_key) ? 'AI Connected' : 'Set AI Key'}</span>
          </button>

          {/* New Chat Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleNewChat}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '0.3rem' }}
            title="Start a fresh conversation"
            id="btn-new-chat"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>

          {/* Conversation History Icon Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleOpenHistory}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '0.3rem' }}
            title="View past conversation history"
            id="btn-open-history"
          >
            <History size={14} style={{ color: 'var(--color-primary)' }} />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* API Key Notice Banner (if not configured) */}
      {!customApiKey && !aiConfig?.has_api_key && (
        <div
          style={{
            padding: '0.45rem 0.85rem',
            marginBottom: '0.45rem',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-warning)' }}>
            <AlertCircle size={14} />
            <span>
              <strong>AI Reasoning Key:</strong> Connect your Google Gemini API Key to enable real-time dataset analysis, predictions, and Q&amp;A.
            </span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsKeyModalOpen(true)}
            style={{ fontSize: '0.6875rem', padding: '0.2rem 0.6rem' }}
          >
            Enter Key
          </button>
        </div>
      )}

      {/* Dataset Selection Bar */}
      <div
        className="card"
        style={{
          padding: '0.45rem 0.85rem',
          marginBottom: '0.55rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.8125rem' }}>
            <Database size={15} /> Selected Target Dataset:
          </div>

          {isLoadingDatasets ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>Loading your datasets...</span>
          ) : datasets.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                className="input"
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  maxWidth: 260,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                }}
                id="select-chat-dataset"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    📊 {d.name} (v{d.version})
                  </option>
                ))}
              </select>

              {selectedDataset && (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.6875rem' }}>
                    {selectedDataset.source_type.toUpperCase()}
                  </span>
                  <span className="badge" style={{ fontSize: '0.6875rem', background: 'var(--bg-surface)' }}>
                    {selectedDataset.rows ? `${selectedDataset.rows.toLocaleString()} rows` : 'Active File'}
                  </span>
                  <span className="badge" style={{ fontSize: '0.6875rem', background: 'var(--bg-surface)', color: 'var(--color-success)' }}>
                    v{selectedDataset.version} · {selectedDataset.stage}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-warning)', fontSize: '0.8125rem' }}>
              <AlertCircle size={15} /> No datasets found. Please upload a dataset first to start analytical chat.
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
          🔒 Statistical summaries strictly evaluated
        </div>
      </div>

      {/* Spacious Messages Canvas Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(17, 24, 39, 0.45)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          marginBottom: '0.65rem',
          minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <div style={{ textAlign: 'center', maxWidth: 640 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 'var(--radius-2xl)',
                  background: 'linear-gradient(135deg, var(--color-primary-subtle), var(--color-accent-subtle))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  boxShadow: '0 8px 28px rgba(99, 102, 241, 0.25)',
                }}
              >
                <Sparkles size={30} style={{ color: 'var(--color-primary)' }} />
              </div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                Data Intelligence Assistant
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {selectedDataset ? (
                  <>
                    Ask statistical queries, correlations, outliers, or predictive metrics regarding <strong>{selectedDataset.name}</strong>. Powered by AI intelligence directly on your dataset's statistical profile.
                  </>
                ) : (
                  'Select a dataset above to start exploring statistical patterns and deep insights.'
                )}
              </p>

              {/* Quick Suggestion Prompts */}
              {selectedDataset && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', maxWidth: 580, margin: '0 auto' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textAlign: 'left' }}>
                    💡 SUGGESTED DATASET QUESTIONS:
                  </span>
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      className="btn btn-secondary"
                      onClick={() => handleSend(q)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                        lineHeight: 1.45,
                        fontSize: '0.875rem',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ flex: 1, textAlign: 'left', wordBreak: 'break-word', marginRight: '0.75rem' }}>
                        {q}
                      </span>
                      <ArrowRight size={15} style={{ opacity: 0.7, flexShrink: 0, color: 'var(--color-primary)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              width: '100%',
              boxSizing: 'border-box',
              animation: 'fadeIn 0.3s ease-out forwards',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-full)',
                flexShrink: 0,
                background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: msg.role === 'assistant' ? '1px solid var(--border-default)' : 'none',
                marginTop: '0.2rem',
                boxShadow: msg.role === 'assistant' ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(20, 184, 166, 0.3)',
              }}
            >
              {msg.role === 'user' ? (
                <User size={19} color="white" />
              ) : (
                <Bot size={19} style={{ color: 'var(--color-primary)' }} />
              )}
            </div>

            <div
              style={{
                flex: msg.role === 'assistant' ? 1 : undefined,
                maxWidth: msg.role === 'assistant' ? '100%' : '75%',
                width: msg.role === 'assistant' ? '100%' : 'auto',
                minWidth: 0,
              }}
            >
              {msg.role === 'user' && msg.datasetName && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'right', marginBottom: 4 }}>
                  Queried on: <strong>{msg.datasetName}</strong>
                </div>
              )}
              {msg.role === 'assistant' && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-tertiary)',
                    marginBottom: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} style={{ color: 'var(--color-primary)' }} />
                    <span>
                      Powered by <strong>{msg.modelName || 'Google Gemini 3.6 Flash'}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {msg.content && (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.6875rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                        title="Copy Response to Clipboard"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={12} style={{ color: 'var(--color-success)' }} />
                            <span style={{ color: 'var(--color-success)' }}>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy Response</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div
                className={msg.role === 'user' ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-assistant'}
                style={{
                  lineHeight: 1.75,
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: msg.role === 'assistant' ? '1.5rem 2rem' : '0.85rem 1.25rem',
                  borderRadius: msg.role === 'assistant' ? 'var(--radius-xl)' : 'var(--radius-lg)',
                  fontSize: '1rem',
                  background: msg.role === 'assistant' ? 'var(--bg-elevated)' : undefined,
                  border: msg.role === 'assistant' ? '1px solid var(--border-default)' : undefined,
                  boxShadow: msg.role === 'assistant' ? '0 4px 24px rgba(0, 0, 0, 0.22)' : undefined,
                }}
              >
                {msg.role === 'user' ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                ) : !msg.content ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.25rem 0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-full)',
                        background: 'rgba(20, 184, 166, 0.15)',
                        color: 'var(--color-primary)',
                        flexShrink: 0,
                      }}
                    >
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Waiting for the response...
                        </span>
                        <span
                          className="animate-pulse"
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-primary)',
                            fontWeight: 700,
                          }}
                        >
                          ●
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Evaluating dataset metrics &amp; synthesizing AI answer
                      </span>
                    </div>
                  </div>
                ) : (
                  <MarkdownRenderer
                    content={msg.content}
                    isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box & Bottom Toolbar */}
      <div style={{ flexShrink: 0 }}>
        {/* Small Suggestion Chips above the Ask area (visible even after chats) */}
        {selectedDataset && messages.length > 0 && !isStreaming && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              overflowX: 'auto',
              paddingBottom: '0.5rem',
              scrollbarWidth: 'none',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                flexShrink: 0,
                paddingLeft: '0.25rem',
              }}
            >
              <Sparkles size={12} style={{ color: 'var(--color-primary)' }} />
              <span>Ask:</span>
            </span>
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                className="btn btn-secondary btn-sm"
                onClick={() => handleSend(q)}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  transition: 'all 0.15s ease',
                }}
                title={q}
              >
                <span>{q}</span>
              </button>
            ))}
          </div>
        )}

        <div
          className="glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-2xl)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <input
            className="input"
            placeholder={
              selectedDataset
                ? `Ask any data analysis question on ${selectedDataset.name} (averages, outliers, correlations)...`
                : 'Select a dataset above to ask questions...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!selectedDataset || isStreaming}
            style={{
              background: 'transparent',
              border: 'none',
              flex: 1,
              padding: '0.5rem 0.25rem',
              fontSize: '1rem',
              color: 'var(--text-primary)',
            }}
            id="chat-input"
          />
          <button
            className="btn btn-primary"
            onClick={() => handleSend()}
            disabled={!input.trim() || !selectedDataset || isStreaming}
            id="chat-send"
            style={{
              borderRadius: 'var(--radius-xl)',
              padding: '0.75rem 1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '0.45rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontSize: '0.9375rem',
              fontWeight: 600,
            }}
          >
            <Send size={16} />
            <span>{isStreaming ? 'Analyzing...' : 'Ask AI'}</span>
          </button>
        </div>
      </div>

      {/* ── Conversation History Slide-Over Drawer ─────────────────────────── */}
      {isHistoryOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000,
          }}
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: 420,
              height: '100%',
              background: 'var(--bg-elevated)',
              borderLeft: '1px solid var(--border-default)',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.25rem',
              borderRadius: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={18} style={{ color: 'var(--color-primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Past Conversations</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleNewChat}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Plus size={13} />
                  <span>New</span>
                </button>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '0.35rem', borderRadius: 'var(--radius-md)' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Conversation List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  Loading history...
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-tertiary)' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>No past conversations</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                    Ask questions on your datasets to start building session history.
                  </p>
                </div>
              ) : (
                historyList.map((item) => {
                  const isCurrent = conversationId === item.id;
                  const dateStr = item.created_at ? formatISTDateTime(item.created_at) : '';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectConversation(item.id)}
                      style={{
                        padding: '0.75rem 0.875rem',
                        borderRadius: 'var(--radius-lg)',
                        background: isCurrent ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface)',
                        border: isCurrent ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      className="history-item-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Database size={12} />
                          <span>{item.dataset_name || 'Dataset'}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                            {dateStr}
                          </span>
                          <button
                            onClick={(e) => handleDeleteConversation(e, item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '2px',
                              cursor: 'pointer',
                              color: 'var(--text-tertiary)',
                              borderRadius: '4px',
                            }}
                            title="Delete conversation"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.8125rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {item.last_message_preview || 'New Conversation'}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                        <span className="badge" style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem', textTransform: 'capitalize' }}>
                          {item.persona}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                          {item.message_count} messages
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── API Key Configuration Modal ────────────────────────────────────── */}
      {isKeyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem',
          }}
          onClick={() => setIsKeyModalOpen(false)}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: 520,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                  }}
                >
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>AI Engine &amp; API Key Settings</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Configure Google Gemini to enable live deep AI data reasoning
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Backend Status */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block' }}>Backend AI Status</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {aiConfig?.has_api_key ? 'Configured on Server' : 'Not configured in Render .env'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  background: (aiConfig?.has_api_key || customApiKey) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: (aiConfig?.has_api_key || customApiKey) ? 'var(--color-success)' : 'var(--color-warning)',
                  border: (aiConfig?.has_api_key || customApiKey) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                {(aiConfig?.has_api_key || customApiKey) ? '● Active' : '● Mock Fallback'}
              </span>
            </div>

            {/* Custom Gemini Key Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Google Gemini API Key
              </label>
              <input
                type="password"
                className="input"
                placeholder="AIzaSy... or AQ..."
                value={customApiKey}
                onChange={(e) => handleSaveApiKey(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '0.875rem' }}
              />
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Your key is stored securely in your browser's local storage and used for live dataset reasoning.
              </p>
            </div>

            {/* Test Result Message */}
            {testResult && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: testResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: testResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                  border: testResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.625rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestApiKey}
                disabled={isTestingKey}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}
              >
                <Sparkles size={14} />
                <span>{isTestingKey ? 'Testing...' : 'Test Connection'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsKeyModalOpen(false)}
                style={{ fontSize: '0.8125rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
