import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Lightbulb, 
  CheckCheck, 
  Download, 
  Copy, 
  ArrowRight
} from 'lucide-react';

export default function SummaryAndImprovements({ scanResult, onNavigateToDiff, onApplyPatch }) {
  const vulnerabilities = scanResult?.vulnerabilities || [];
  const filesTree = scanResult?.files_tree || [];
  const totalFiles = scanResult?.files_scanned || filesTree.length || 1;
  const cleanFilesCount = filesTree.filter(f => !f.is_buggy).length;
  
  const [copied, setCopied] = useState(false);

  // Health Score Calculation
  const criticalCount = vulnerabilities.filter(v => (v.severity_level || '').toLowerCase() === 'critical').length;
  const majorCount = vulnerabilities.filter(v => (v.severity_level || '').toLowerCase() === 'major').length;
  const minorCount = vulnerabilities.filter(v => (v.severity_level || '').toLowerCase() === 'minor').length;

  let healthGrade = 'A';
  let healthColor = 'text-emerald-500 dark:text-emerald-400';
  let healthBg = 'bg-emerald-500/10 border-emerald-500/30';
  let healthScore = 100 - (criticalCount * 25 + majorCount * 15 + minorCount * 5);
  if (healthScore < 0) healthScore = 0;

  if (criticalCount > 0 || healthScore < 70) {
    healthGrade = 'C';
    healthColor = 'text-red-500 dark:text-red-400';
    healthBg = 'bg-red-500/10 border-red-500/30';
  } else if (majorCount > 0 || healthScore < 85) {
    healthGrade = 'B';
    healthColor = 'text-amber-500 dark:text-amber-400';
    healthBg = 'bg-amber-500/10 border-amber-500/30';
  }

  // Generate downloadable improvement report
  const generateMarkdownSummary = () => {
    let md = `# Project Bug & Quality Improvement Summary\n\n`;
    md += `**Target Repository:** \`${scanResult?.repository_url || 'Target Project'}\`\n`;
    md += `**Scan Date:** ${scanResult?.scan_timestamp || new Date().toLocaleString()}\n`;
    md += `**Files Analyzed:** ${totalFiles} | **Issues Detected:** ${vulnerabilities.length} | **Health Score:** ${healthScore}/100 (Grade ${healthGrade})\n\n`;
    md += `---\n\n## 1. Executive Summary\n`;
    md += `During the automated analysis, ${vulnerabilities.length} potential logic defects or vulnerabilities were identified across ${totalFiles} scanned files. `;
    md += `${cleanFilesCount} files passed all structural checks with zero defects.\n\n`;
    
    md += `## 2. Issues Breakdown\n`;
    vulnerabilities.forEach((v, i) => {
      md += `### ${i + 1}. [${(v.severity_level || 'Defect').toUpperCase()}] ${v.bug_type} in \`${v.file_path}\`\n`;
      md += `- **Function:** \`${v.method_name}()\` (Lines ${v.line_number_start}-${v.line_number_end})\n`;
      md += `- **Root Cause:** ${v.explanation}\n`;
      md += `- **Suggested Patch:**\n\`\`\`javascript\n${v.suggested_fix_code}\n\`\`\`\n\n`;
    });

    md += `## 3. Recommended Code Quality Improvements\n`;
    md += `- **Defensive Array & Object Boundaries:** Add explicit boundary checks for array access and slices.\n`;
    md += `- **Async/Await Flow Handling:** Ensure all promises and async operations handle errors with try/catch or .catch().\n`;
    md += `- **Strict State Immutability:** Use pure updater functions instead of directly mutating state objects.\n`;
    md += `- **Static Type & Linter Rules:** Enable TypeScript strict mode and configure ESLint rules for async operations.\n`;

    return md;
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(generateMarkdownSummary());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSummary = () => {
    const text = generateMarkdownSummary();
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `Project_Improvements_Summary.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="w-full max-w-7xl mx-auto my-4 space-y-5">
      
      {/* 1. Top Executive Banner */}
      <div className="ui-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Executive Scan Report
            </span>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1">
              Summary &amp; Engineering Improvements
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Overview of codebase quality, defect patterns, and actionable architectural recommendations.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
              <span>{copied ? "Copied!" : "Copy Summary"}</span>
            </button>
            <button
              onClick={handleDownloadSummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent-btn-bg)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics & Health Score Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Health Grade Card */}
        <div className={`p-4 rounded-md border ${healthBg} flex items-center justify-between`}>
          <div>
            <div className="text-xs text-[var(--text-secondary)] font-medium">Code Health Grade</div>
            <div className={`text-2xl font-bold mt-1 ${healthColor}`}>
              Grade {healthGrade}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{healthScore}/100 Quality Score</div>
          </div>
          <div className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-lg ${healthColor} bg-[var(--bg-surface)] border border-[var(--border-subtle)]`}>
            {healthGrade}
          </div>
        </div>

        {/* Total Files Card */}
        <div className="ui-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Files Analyzed</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">{totalFiles}</div>
          <div className="text-[11px] text-emerald-500 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{cleanFilesCount} files clean (0 defects)</span>
          </div>
        </div>

        {/* Issues Found Card */}
        <div className="ui-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Total Defects Identified</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">{vulnerabilities.length}</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {criticalCount} Critical &bull; {majorCount} Major &bull; {minorCount} Minor
          </div>
        </div>

        {/* Automated Fixes Ready */}
        <div className="ui-card p-4">
          <div className="text-xs text-[var(--text-muted)]">Automated Patches Ready</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">{vulnerabilities.length}</div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Ready for 1-click review &amp; apply</div>
        </div>
      </div>

      {/* 3. Findings & Improvement Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Column: Detected Issues Summary (6 cols) */}
        <div className="lg:col-span-6 ui-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Detected Defect Findings</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Summary of flagged methods with proposed fixes</p>
            </div>

            <button
              onClick={() => onNavigateToDiff(0)}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-primary)] hover:underline font-medium transition-colors cursor-pointer"
            >
              <span>Inspect Diffs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {vulnerabilities.length === 0 ? (
              <div className="p-6 text-center text-[var(--text-secondary)] text-xs bg-[var(--bg-subtle)] rounded-md border border-[var(--border-subtle)]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-[var(--text-primary)]">No defects detected in this repository!</p>
                <p className="mt-1 text-[var(--text-muted)]">All analyzed methods passed AST and pattern verification.</p>
              </div>
            ) : (
              vulnerabilities.map((v, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        (v.severity_level || '').toLowerCase() === 'critical'
                          ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/30'
                          : 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                      }`}>
                        {v.severity_level || 'Defect'}
                      </span>
                      <span className="font-semibold text-xs text-[var(--text-primary)]">{v.bug_type}</span>
                    </div>

                    <span className="font-mono text-[11px] text-[var(--text-muted)]">
                      Lines {v.line_number_start}-{v.line_number_end}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {v.explanation}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[11px]">
                    <span className="font-mono text-[var(--text-muted)] truncate max-w-[240px]">
                      {v.file_path} &bull; <span className="text-[var(--text-primary)]">{v.method_name}()</span>
                    </span>

                    <button
                      onClick={() => onNavigateToDiff(idx)}
                      className="text-[var(--text-primary)] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Diff</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Recommended Code Quality Improvements (6 cols) */}
        <div className="lg:col-span-6 ui-card p-5 space-y-4">
          <div className="pb-3 border-b border-[var(--border-subtle)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Recommended Engineering Improvements</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Best practices to prevent similar defects in future releases</p>
          </div>

          <div className="space-y-3">
            
            {/* Recommendation 1 */}
            <div className="p-3.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text-primary)]">
                <div className="w-5 h-5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px]">
                  1
                </div>
                <span>Defensive Boundary &amp; Null Checks</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-7">
                Validate array lengths before slicing or sorting, and use optional chaining (<code className="text-[var(--text-primary)] font-mono">?.</code>) or nullish coalescing (<code className="text-[var(--text-primary)] font-mono">??</code>) to prevent runtime crashes.
              </p>
            </div>

            {/* Recommendation 2 */}
            <div className="p-3.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text-primary)]">
                <div className="w-5 h-5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px]">
                  2
                </div>
                <span>Async / Await Flow Handling</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-7">
                Always <code className="text-[var(--text-primary)] font-mono">await</code> asynchronous calls and encapsulate them in <code className="text-[var(--text-primary)] font-mono">try / catch</code> blocks to prevent silent promise rejections and unhandled errors.
              </p>
            </div>

            {/* Recommendation 3 */}
            <div className="p-3.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text-primary)]">
                <div className="w-5 h-5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px]">
                  3
                </div>
                <span>Strict State Immutability</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-7">
                Never mutate state directly (e.g. <code className="text-[var(--text-primary)] font-mono">array.sort()</code> in-place). Create shallow or deep copies before executing mutating operations.
              </p>
            </div>

            {/* Recommendation 4 */}
            <div className="p-3.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text-primary)]">
                <div className="w-5 h-5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px]">
                  4
                </div>
                <span>Automated Static Analysis in CI/CD</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-7">
                Integrate automated AST scanning and linter rules in your GitHub Actions / GitLab CI pipeline to catch defects prior to merging pull requests.
              </p>
            </div>

          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateToDiff}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-[var(--accent-btn-bg)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] font-semibold text-xs transition-colors cursor-pointer"
            >
              <span>Go to Code Review &amp; Apply Patches</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
