import React, { useState, useEffect } from 'react';
import { X, Database, GitCommit, Search, Shield, PieChart } from 'lucide-react';

export default function DatasetStatsModal({ isOpen, onClose }) {
  const [stats, setStats] = useState(null);
  const [samples, setSamples] = useState([]);
  const [selectedBugType, setSelectedBugType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    Promise.all([
      fetch('/api/dataset/stats').then(res => res.json()),
      fetch('/api/dataset/samples?limit=30').then(res => res.json())
    ])
      .then(([statsData, samplesData]) => {
        setStats(statsData);
        setSamples(samplesData.samples || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading dataset stats:", err);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredSamples = samples.filter(s => {
    const matchesType = selectedBugType === 'all' || s.bug_type?.toLowerCase() === selectedBugType.toLowerCase();
    const matchesSearch = !searchQuery || 
      s.commit_message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.bug_type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl ui-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
              <Database className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                Bug-Fix Benchmark Dataset
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-medium bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  {stats?.total_pairs || 3179} Verified Pairs
                </span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Historical bug-fix pairs used for AST delta matching and repair synthesis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 bg-[var(--bg-surface-elevated)]">
          
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Total Indexed Pairs</div>
              <div className="text-xl font-bold text-[var(--text-primary)] mt-1 font-mono">{stats?.total_pairs || 3179}</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Verified Twins</div>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">AST Vector Dimensions</div>
              <div className="text-xl font-bold text-[var(--text-primary)] mt-1 font-mono">64 / 120-D</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Structural Geometry</div>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Boundary Check Fixes</div>
              <div className="text-xl font-bold text-emerald-500 mt-1 font-mono">
                {stats?.delta_metrics?.total_boundary_check_fixes || 409}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Defensive Guard Fixes</div>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-muted)] font-medium">Async / Await Fixes</div>
              <div className="text-xl font-bold text-amber-500 mt-1 font-mono">
                {stats?.delta_metrics?.total_async_await_fixes || 152}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Promise Timing Fixes</div>
            </div>
          </div>

          {/* Bug Types & Severity Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Bug Types Distribution</span>
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {stats?.bug_types && Object.entries(stats.bug_types).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs font-medium">
                    <span className="text-[var(--text-secondary)]">{type}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Severity Classifications</span>
              </h4>
              <div className="space-y-1.5">
                {stats?.severities && Object.entries(stats.severities).map(([sev, count]) => (
                  <div key={sev} className="flex items-center justify-between text-xs font-medium">
                    <span className="text-[var(--text-secondary)]">{sev}</span>
                    <span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Search & Filter Historical Samples Table */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-[var(--text-secondary)]" />
                <span>Historical Bug-Fix Samples</span>
              </h4>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search commits or repo..."
                  className="w-full pl-8 pr-3 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface)]">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] font-mono text-[10px] uppercase sticky top-0 border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Repository</th>
                      <th className="p-2.5">Bug Category</th>
                      <th className="p-2.5">Severity</th>
                      <th className="p-2.5">Structural Fix</th>
                      <th className="p-2.5">Commit Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {filteredSamples.map((s) => (
                      <tr key={s.pair_id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                        <td className="p-2.5 font-mono text-[var(--text-primary)] font-bold">#{s.pair_id}</td>
                        <td className="p-2.5 truncate max-w-[120px] font-mono text-[var(--text-muted)]">{s.project_name}</td>
                        <td className="p-2.5">{s.bug_type}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            s.severity === 'Critical' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                          }`}>
                            {s.severity}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                          {`+${s.delta_signature?.added_boundary_check || 0} guard, +${s.delta_signature?.added_await || 0} await`}
                        </td>
                        <td className="p-2.5 truncate max-w-[200px] text-[var(--text-secondary)]">{s.commit_message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border-subtle)] transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
