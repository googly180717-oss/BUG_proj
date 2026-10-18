import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

const PIPELINE_STEPS = [
  { step: 1, title: "Input Ingestion", desc: "Validating target repository or archive" },
  { step: 2, title: "Project Structure", desc: "Mapping directory hierarchy and files" },
  { step: 3, title: "File Selection", desc: "Filtering JS, JSX, TS, and TSX files" },
  { step: 4, title: "AST Parsing", desc: "Parsing source code into syntax trees" },
  { step: 5, title: "Function Slicing", desc: "Extracting standalone functions and methods" },
  { step: 6, title: "Feature Extraction", desc: "Computing complexity and AST geometry" },
  { step: 7, title: "Pattern Matching", desc: "Comparing functions against historical bug-fix pairs" },
  { step: 8, title: "Fix Synthesis", desc: "Synthesizing and formatting candidate patches" },
  { step: 9, title: "Verification", desc: "Verifying repair syntax and boundary correctness" },
  { step: 10, title: "Report Generation", desc: "Compiling findings into diagnostic summary" },
  { step: 11, title: "Ready", desc: "Rendering interactive explorer and diff viewer" },
];

export default function ScanProgressLogger({ currentStep = 1, logs = [] }) {
  const percent = Math.min(100, Math.round((currentStep / 11) * 100));

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <div className="ui-card p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-[var(--text-primary)] animate-spin" />
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                Analyzing Codebase — Step {currentStep} of 11
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {PIPELINE_STEPS[currentStep - 1]?.desc || "Processing..."}
              </p>
            </div>
          </div>
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{percent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-[var(--bg-subtle)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
            <div
              className="bg-[var(--accent-btn-bg)] h-full transition-all duration-300 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Steps Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
          {PIPELINE_STEPS.map((s) => {
            const isDone = s.step < currentStep;
            const isCurrent = s.step === currentStep;

            return (
              <div
                key={s.step}
                className={`p-2.5 rounded-md border transition-all ${
                  isCurrent
                    ? 'bg-[var(--bg-surface-elevated)] border-[var(--border-strong)] text-[var(--text-primary)] shadow-xs'
                    : isDone
                    ? 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    : 'bg-[var(--bg-subtle)]/40 border-[var(--border-subtle)]/40 text-[var(--text-muted)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">Step {s.step}</span>
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-[var(--text-primary)] animate-spin" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-medium)]" />
                  )}
                </div>
                <div className="font-medium text-[var(--text-primary)] truncate mt-1">{s.title}</div>
              </div>
            );
          })}
        </div>

        {/* Terminal Log */}
        <div className="mt-5 bg-[var(--bg-subtle)] rounded-md p-3.5 border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-secondary)] max-h-32 overflow-y-auto space-y-1">
          <div className="text-[var(--text-muted)]">// Execution audit ledger:</div>
          <div className="text-[var(--text-primary)] font-medium">
            [Step {currentStep}/11] {PIPELINE_STEPS[currentStep - 1]?.desc}
          </div>
        </div>

      </div>
    </div>
  );
}
