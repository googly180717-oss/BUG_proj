import React from 'react';
import { Bug, Activity, Shield, Wifi, WifiOff, Moon, Sparkles } from 'lucide-react';

export default function Navbar({ systemStatus, theme, onThemeChange }) {
  const isOnline = systemStatus?.status === 'online';

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-lg border border-[var(--border-medium)] bg-[var(--bg-surface-elevated)] shadow-sm">
              <Bug className="w-4 h-4 text-[var(--text-primary)]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">BugIdentifier</span>
              <span className="text-xs text-[var(--text-muted)] font-mono">v2.0</span>
            </div>
          </div>

          {/* Right Controls: Status Pills & Theme Selector */}
          <div className="flex items-center gap-2.5 text-xs">
            
            {/* Backend API Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition-colors ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Gateway Online' : 'Gateway Offline'}</span>
            </div>

            {/* DB Storage Engine */}
            {systemStatus && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] font-medium">
                <Shield className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>{systemStatus.db_mode || 'Hybrid RAG'}</span>
              </div>
            )}

            {/* LLM Engine */}
            {systemStatus?.llm_provider && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] font-medium">
                <Activity className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="truncate max-w-[200px]">{systemStatus.llm_provider}</span>
              </div>
            )}

            {/* Production Theme Switcher: Dark vs Silver */}
            <div className="flex items-center p-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[var(--accent-btn-bg)] text-[var(--accent-btn-text)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Switch to Obsidian Dark"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('silver')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  theme === 'silver'
                    ? 'bg-[var(--accent-btn-bg)] text-[var(--accent-btn-text)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Switch to Platinum Silver"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Silver</span>
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
