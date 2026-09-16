'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import {
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCw,
  Trash2,
  Lock,
  Cpu,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface AiConfigData {
  configured: boolean;
  provider: 'GEMINI' | 'OPENAI' | null;
  providerName: string | null;
  model: string | null;
  isActive: boolean;
  connectionStatus: 'CONNECTED' | 'NOT_CONFIGURED' | 'CONNECTION_FAILED';
  lastTestedAt: string | null;
  maskedApiKey: string | null;
  updatedAt: string | null;
}

export default function AiConfigurationPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testingLoading, setTestingLoading] = useState(false);

  // Form State
  const [provider, setProvider] = useState<'GEMINI' | 'OPENAI'>('GEMINI');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  // Feedback Messages
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const isCompanyAdmin =
    user?.roles?.includes('COMPANY_ADMIN') || user?.roles?.includes('PLATFORM_SUPER_ADMIN');

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/ai/config');
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data);
        if (json.data.provider) {
          setProvider(json.data.provider);
        }
        if (json.data.model) {
          setModel(json.data.model);
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to load AI configuration' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCompanyAdmin) {
      fetchConfig();
    } else {
      setLoading(false);
    }
  }, [isCompanyAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) {
      setFeedback({ type: 'error', message: 'Please enter an API key.' });
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);

      const res = await fetch('/api/v1/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          model: model || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'success', message: json.data.message || 'API Key saved successfully!' });
        setApiKey('');
        setIsRotating(false);
        await fetchConfig();
      } else {
        setFeedback({ type: 'error', message: json.error?.message || 'Failed to save configuration.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'An unexpected error occurred.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingLoading(true);
      setFeedback(null);

      const payload: any = {};
      if (apiKey) {
        payload.provider = provider;
        payload.apiKey = apiKey;
        payload.model = model || undefined;
      }

      const res = await fetch('/api/v1/ai/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback({
          type: 'success',
          message: json.data?.message || 'Connection test successful! Provider verified.',
        });
        await fetchConfig();
      } else {
        setFeedback({
          type: 'error',
          message: json.error?.message || json.data?.message || 'Connection test failed.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to complete connection test.' });
    } finally {
      setTestingLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove the tenant AI API key configuration?')) {
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);

      const res = await fetch('/api/v1/ai/config', {
        method: 'DELETE',
      });

      const json = await res.json();
      if (json.success) {
        setFeedback({ type: 'info', message: 'AI Provider configuration removed.' });
        setApiKey('');
        setIsRotating(false);
        await fetchConfig();
      } else {
        setFeedback({ type: 'error', message: json.error?.message || 'Failed to remove configuration.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to remove configuration.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isCompanyAdmin) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-6 rounded-xl text-center">
            <ShieldCheck className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-red-900 dark:text-red-200">Access Restricted</h2>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Only authorized tenant administrators (Company Admin) can configure organization AI Provider credentials.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusBadge = () => {
    if (!config || !config.configured || config.connectionStatus === 'NOT_CONFIGURED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
          Not Configured
        </span>
      );
    }

    if (config.connectionStatus === 'CONNECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Connected & Verified
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
        Connection Failed
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
              Settings & Integrations
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              AI Provider API Key Configuration
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Securely connect your organization's own AI provider API key for AI Copilot, RAG Policy Q&A, and ATS Matching.
            </p>
          </div>

          <div className="flex items-center gap-3">{getStatusBadge()}</div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 border text-xs leading-relaxed ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200 border-blue-200 dark:border-blue-800'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />}
            {feedback.type === 'error' && <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />}
            {feedback.type === 'info' && <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />}
            <div className="flex-1 font-medium">{feedback.message}</div>
          </div>
        )}

        {/* Main Configuration Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Provider Credentials</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  AES-256 encrypted server-side. Plaintext is never exposed in browser or logs.
                </p>
              </div>
            </div>

            {config?.configured && !isRotating && (
              <button
                type="button"
                onClick={() => setIsRotating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Rotate API Key
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Select AI Provider
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition select-none ${
                    provider === 'GEMINI'
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="GEMINI"
                    checked={provider === 'GEMINI'}
                    onChange={() => {
                      setProvider('GEMINI');
                      setModel('gemini-1.5-flash');
                    }}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      Google Gemini
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Gemini 1.5 Flash / Pro. High-speed, large context window for employee handbooks & RAG.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition select-none ${
                    provider === 'OPENAI'
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value="OPENAI"
                    checked={provider === 'OPENAI'}
                    onChange={() => {
                      setProvider('OPENAI');
                      setModel('gpt-4o-mini');
                    }}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      OpenAI
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      GPT-4o / GPT-4o-mini. Industry standard reasoning for ATS candidate parsing and complex queries.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Default LLM Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {provider === 'GEMINI' ? (
                  <>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Cost-Effective)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning & Document RAG)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Latest Fast Generation)</option>
                  </>
                ) : (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini (Fast & Efficient)</option>
                    <option value="gpt-4o">gpt-4o (High Precision Multimodal)</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy Standard)</option>
                  </>
                )}
              </select>
            </div>

            {/* API Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  API Key
                </label>
                {provider === 'GEMINI' ? (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    Get Google AI Studio Key <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    Get OpenAI Platform Key <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {config?.configured && !isRotating ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-mono text-xs">
                    <Lock className="h-4 w-4 text-emerald-500" />
                    <span>{config.maskedApiKey || '••••••••••••••••••••••••••••'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Saved & Encrypted
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      provider === 'GEMINI'
                        ? 'Enter Google Gemini API Key (AIzaSy...)'
                        : 'Enter OpenAI API Key (sk-...)'
                    }
                    className="w-full text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoComplete="new-password"
                  />
                  {isRotating && (
                    <button
                      type="button"
                      onClick={() => setIsRotating(false)}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingLoading || actionLoading || (!config?.configured && !apiKey)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${testingLoading ? 'animate-spin' : ''}`} />
                  {testingLoading ? 'Testing...' : 'Test Connection'}
                </button>

                {config?.configured && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={actionLoading || testingLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Key
                  </button>
                )}
              </div>

              {(!config?.configured || isRotating) && (
                <button
                  type="submit"
                  disabled={actionLoading || !apiKey}
                  className="flex items-center gap-1.5 px-6 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save API Key'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Security & Multi-Tenancy Architecture Card */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Security & Tenant Isolation Guarantees
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <div className="p-3.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-500" /> AES-256 Encryption
              </div>
              <p>
                API keys are encrypted in-memory before database persistence. Plaintext keys are never logged or stored.
              </p>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Tenant Scoped
              </div>
              <p>
                Credentials strictly belong to your tenant. Cross-tenant credential sharing or access is physically blocked.
              </p>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-emerald-500" /> Grounded RAG
              </div>
              <p>
                Your configured key is used by the AI Copilot and RAG engine while strictly respecting existing RBAC guardrails.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
