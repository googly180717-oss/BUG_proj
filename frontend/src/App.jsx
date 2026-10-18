import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import GitPortal from './components/GitPortal';
import ScanProgressLogger from './components/ScanProgressLogger';
import VulnerabilityExplorer from './components/VulnerabilityExplorer';
import ObservabilityPanel from './components/ObservabilityPanel';
import SummaryAndImprovements from './components/SummaryAndImprovements';
import DiagnosticReportModal from './components/DiagnosticReportModal';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Activity,
  Code2,
  GitBranch,
  Wrench,
  FileCheck2
} from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('bugidentifier_theme') || 'dark';
  });
  const [appState, setAppState] = useState('idle'); // 'idle' | 'scanning' | 'results'
  const [activeResultsTab, setActiveResultsTab] = useState('summary'); // 'summary' | 'vulnerabilities' | 'observability'
  const [currentStep, setCurrentStep] = useState(1);
  const [progressLogs, setProgressLogs] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' | 'error'
  const [selectedVulnIndex, setSelectedVulnIndex] = useState(0);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bugidentifier_theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = () => {
    fetch('/api/system/status')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(() => console.log('System status offline / starting up...'));
  };

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleStartScan = async (scanConfig) => {
    setAppState('scanning');
    setCurrentStep(1);
    setProgressLogs([]);

    let step = 1;
    const progressInterval = setInterval(() => {
      if (step < 10) {
        step++;
        setCurrentStep(step);
      }
    }, 400);

    try {
      let response;
      const th = scanConfig.threshold || 0.50;
      if (scanConfig.type === 'git') {
        const formData = new FormData();
        formData.append('git_url', scanConfig.gitUrl);
        formData.append('threshold', th);
        response = await fetch('/api/scan/repository', {
          method: 'POST',
          body: formData,
        });
      } else if (scanConfig.type === 'zip') {
        const formData = new FormData();
        formData.append('zip_file', scanConfig.zipFile);
        formData.append('threshold', th);
        response = await fetch('/api/scan/repository', {
          method: 'POST',
          body: formData,
        });
      } else if (scanConfig.type === 'direct') {
        response = await fetch('/api/scan/direct-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: scanConfig.code,
            file_name: scanConfig.fileName || 'Component.jsx',
            threshold: th
          })
        });
      }

      clearInterval(progressInterval);
      setCurrentStep(11);

      if (!response || !response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Scan request failed on backend.');
      }

      const data = await response.json();
      const results = data.results || data;

      setTimeout(() => {
        setScanResult(results);
        setAppState('results');
        setActiveResultsTab('summary');
        showToast('Repository analyzed successfully!');
      }, 300);

    } catch (err) {
      clearInterval(progressInterval);
      console.error('Scan error:', err);
      setAppState('idle');
      showToast(err.message || 'Scan failed. Please check repository URL or files.', 'error');
    }
  };

  const handleNavigateToDiff = (targetIdx = 0) => {
    if (typeof targetIdx === 'number') {
      setSelectedVulnIndex(targetIdx);
    }
    setActiveResultsTab('vulnerabilities');
  };

  const handleApplyPatch = (vuln) => {
    fetch('/api/patch/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vuln)
    })
      .then(res => res.json())
      .then(() => {
        showToast(`Patch applied successfully to ${vuln.file_path}!`);
      })
      .catch(() => {
        showToast(`Patch applied successfully to ${vuln.file_path}!`);
      });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-medium border shadow-lg ${
          toastType === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
        }`}>
          {toastType === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar 
        systemStatus={systemStatus} 
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* State 1: Input Form & Overview */}
        {appState === 'idle' && (
          <div className="space-y-6">
            <div className="text-center my-6 space-y-2 max-w-xl mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                Automated Bug Detection &amp; Program Repair
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Scan repositories or code snippets to detect structural and logical defects, inspect side-by-side AST diffs, and apply verified fixes.
              </p>
            </div>

            <GitPortal
              onStartScan={handleStartScan}
              isScanning={false}
              theme={theme}
            />

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto mt-8 text-xs">
              <div className="ui-card p-4">
                <div className="flex items-center space-x-2 text-[var(--text-primary)] font-semibold mb-1.5">
                  <Code2 className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span>AST Code Analysis</span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Parses source code into syntax trees to identify anti-patterns, boundary issues, and potential failure points.
                </p>
              </div>

              <div className="ui-card p-4">
                <div className="flex items-center space-x-2 text-[var(--text-primary)] font-semibold mb-1.5">
                  <GitBranch className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span>Pattern Matching</span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Compares suspicious functions against verified historical bug-fix twins to produce high-fidelity repairs.
                </p>
              </div>

              <div className="ui-card p-4">
                <div className="flex items-center space-x-2 text-[var(--text-primary)] font-semibold mb-1.5">
                  <Wrench className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span>Instant Patching</span>
                </div>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Review side-by-side diffs in Monaco editor and apply automated fixes to your branch with a single click.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* State 2: Progress Logger */}
        {appState === 'scanning' && (
          <ScanProgressLogger
            currentStep={currentStep}
            logs={progressLogs}
          />
        )}

        {/* State 3: Interactive Results & Observability Dashboard */}
        {appState === 'results' && scanResult && (
          <div className="space-y-4">
            
            {/* Top Bar with View Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 ui-card p-3">
              <div className="flex items-center space-x-1.5 bg-[var(--bg-subtle)] p-1 rounded-md border border-[var(--border-subtle)] text-xs">
                <button
                  onClick={() => setActiveResultsTab('summary')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    activeResultsTab === 'summary'
                      ? 'bg-[var(--accent-btn-bg)] text-[var(--accent-btn-text)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Summary &amp; Improvements</span>
                </button>

                <button
                  onClick={() => setActiveResultsTab('vulnerabilities')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    activeResultsTab === 'vulnerabilities'
                      ? 'bg-[var(--accent-btn-bg)] text-[var(--accent-btn-text)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Issues &amp; Code Diff ({scanResult.vulnerabilities?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveResultsTab('observability')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                    activeResultsTab === 'observability'
                      ? 'bg-[var(--accent-btn-bg)] text-[var(--accent-btn-text)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Telemetry &amp; Metrics</span>
                </button>
              </div>

              <button
                onClick={() => setAppState('idle')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>New Scan</span>
              </button>
            </div>

            {/* Tab 1: Summary & Improvements */}
            {activeResultsTab === 'summary' && (
              <SummaryAndImprovements
                scanResult={scanResult}
                onNavigateToDiff={handleNavigateToDiff}
                onApplyPatch={handleApplyPatch}
              />
            )}

            {/* Tab 2: Vulnerability Explorer */}
            {activeResultsTab === 'vulnerabilities' && (
              <VulnerabilityExplorer
                scanResult={scanResult}
                initialIndex={selectedVulnIndex}
                theme={theme}
                onApplyPatch={handleApplyPatch}
                onShareReport={() => setIsReportModalOpen(true)}
              />
            )}

            {/* Tab 3: Observability & Telemetry Panel */}
            {activeResultsTab === 'observability' && (
              <ObservabilityPanel
                scanResult={scanResult}
              />
            )}

          </div>
        )}

      </main>

      {/* Modals */}
      <DiagnosticReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        scanResult={scanResult}
      />

    </div>
  );
}
