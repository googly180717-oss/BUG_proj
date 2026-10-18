import React, { useState, useEffect } from 'react';
import { GitBranch, Upload, Code2, ArrowRight, AlertCircle, ChevronDown } from 'lucide-react';
import DirectCodeModal from './DirectCodeModal';

const SCAN_MODES = [
  { id: 'git',    label: 'GitHub URL',     icon: GitBranch },
  { id: 'zip',    label: 'Upload ZIP',     icon: Upload    },
  { id: 'direct', label: 'Code Snippet',   icon: Code2     },
];

const THRESHOLD_OPTIONS = [
  { value: 0.30, label: '0.30 — Sensitive (broader matching)' },
  { value: 0.50, label: '0.50 — Balanced (recommended standard)' },
  { value: 0.70, label: '0.70 — Strict (high precision)' },
  { value: 0.80, label: '0.80 — High Confidence only' },
];

export default function GitPortal({ onStartScan, isScanning, theme }) {
  const [mode, setMode] = useState('git');
  const [gitUrl, setGitUrl] = useState('');
  const [zipFile, setZipFile] = useState(null);
  const [threshold, setThreshold] = useState(0.50);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/dataset/suggestions')
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions || []))
      .catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'git') {
      if (!gitUrl.trim()) { setError('Please enter a GitHub repository URL.'); return; }
      if (!gitUrl.startsWith('http')) { setError('Please enter a valid URL starting with http:// or https://'); return; }
      onStartScan({ type: 'git', gitUrl: gitUrl.trim(), threshold });
    } else if (mode === 'zip') {
      if (!zipFile) { setError('Please select a ZIP file archive.'); return; }
      onStartScan({ type: 'zip', zipFile, threshold });
    }
  };

  const handleDirectScan = (code, fileName) => {
    onStartScan({ type: 'direct', code, fileName, threshold });
  };

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <div className="ui-card overflow-hidden">
          
          {/* Mode Tabs */}
          <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            {SCAN_MODES.map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMode(m.id); setError(''); if (m.id === 'direct') setIsDirectModalOpen(true); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-xs font-medium transition-all border-b-2 cursor-pointer ${
                    isActive
                      ? 'border-[var(--text-primary)] text-[var(--text-primary)] bg-[var(--bg-surface)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Git URL Input */}
            {mode === 'git' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  GitHub Repository URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={gitUrl}
                  onChange={e => setGitUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-md text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                />
                {/* Sample Repos */}
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[var(--text-muted)]">Verified Benchmarks:</span>
                    {suggestions.slice(0, 3).map((s, i) => {
                      const urlStr = typeof s === 'string' ? s : (s?.url || s?.name || '');
                      const labelStr = typeof s === 'string' 
                        ? s.replace('https://github.com/', '') 
                        : (s?.name || s?.url || 'repo').replace('https://github.com/', '');
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setGitUrl(urlStr)}
                          className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition font-mono truncate max-w-[200px] cursor-pointer"
                        >
                          {labelStr}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ZIP Upload */}
            {mode === 'zip' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  ZIP Archive <span className="text-red-500">*</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-[var(--border-subtle)] rounded-md cursor-pointer bg-[var(--bg-subtle)] hover:border-[var(--border-medium)] transition-colors">
                  <div className="flex flex-col items-center gap-1 text-[var(--text-muted)]">
                    <Upload className="w-5 h-5 text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-primary)] font-medium">
                      {zipFile ? zipFile.name : 'Select or drop ZIP file archive here'}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">Upload .zip archive containing source code</span>
                  </div>
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={e => setZipFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}

            {/* Direct Code mode */}
            {mode === 'direct' && (
              <div className="flex flex-col items-center justify-center py-6 text-[var(--text-muted)] gap-3 bg-[var(--bg-subtle)] rounded-md border border-[var(--border-subtle)]">
                <Code2 className="w-7 h-7 text-[var(--text-secondary)]" />
                <p className="text-xs text-[var(--text-primary)]">Inspect and repair standalone JavaScript or TypeScript functions.</p>
                <button
                  type="button"
                  onClick={() => setIsDirectModalOpen(true)}
                  className="px-4 py-2 rounded-md bg-[var(--accent-btn-bg)] text-[var(--accent-btn-text)] hover:bg-[var(--accent-btn-hover)] text-xs font-medium transition-all shadow-xs cursor-pointer"
                >
                  Open Code Inspector
                </button>
              </div>
            )}

            {/* Threshold Selector */}
            {mode !== 'direct' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-primary)]">
                  Defect Detection Sensitivity
                </label>
                <div className="relative">
                  <select
                    value={threshold}
                    onChange={e => setThreshold(parseFloat(e.target.value))}
                    className="w-full appearance-none px-3.5 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] transition-colors pr-8 cursor-pointer"
                  >
                    {THRESHOLD_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            {mode !== 'direct' && (
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isScanning}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[var(--accent-btn-bg)] text-[var(--accent-btn-text)] hover:bg-[var(--accent-btn-hover)] disabled:opacity-50 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <span>Analyze Repository</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Direct Code Modal */}
      <DirectCodeModal
        isOpen={isDirectModalOpen}
        onClose={() => { setIsDirectModalOpen(false); setMode('git'); }}
        onRunDirectScan={handleDirectScan}
        theme={theme}
      />
    </>
  );
}
