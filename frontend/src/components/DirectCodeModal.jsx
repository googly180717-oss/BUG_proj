import React, { useState } from 'react';
import { X, Play, Terminal, Code2 } from 'lucide-react';

const SAMPLE_SNIPPETS = [
  {
    name: "Voting App (Age Eligibility Bug)",
    fileName: "voting.js",
    code: `// ---- VOTING ELIGIBILITY CHECK ----
function checkEligibility(voterName, voterAge, voterID) {
  if (!voterName || !voterAge || !voterID) {
    return { eligible: false, message: "Please fill in all fields." };
  }
  if (isNaN(voterAge) || voterAge < 1 || voterAge > 120) {
    return { eligible: false, message: "Please enter a valid age." };
  }

  // BUG: Inverted condition - minors (< 18) are marked eligible!
  // Correct requirement: age >= 18
  if (voterAge < 18) {
    return { eligible: true, message: \`Eligible! Welcome \${voterName}.\` };
  } else {
    return { eligible: false, message: \`Not eligible. Must be above 18. Age: \${voterAge}\` };
  }
}`
  },
  {
    name: "Redux State Mutation",
    fileName: "Blogs.jsx",
    code: `const Blogs = () => {
  const posts = useSelector((state) => state.postsReducer);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchPostsApi());
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="mt-32 md:mt-40">
      <div className="flex gap-3 ml-5 md:ml-0 mb-6">
        <h2 className="text-2xl md:text-4xl">Latest Blogs</h2>
        <div className="border-b-2 mb-3 border-secondaryColor hr-blog" />
      </div>
      {posts.map((post) => (
        <BlogCard key={post.id} post={post} />
      ))}
    </div>
  );
};`
  },
  {
    name: "Async Token Handling",
    fileName: "auth.js",
    code: `async function fetchUserProfile(userId) {
  const response = fetch('/api/user/' + userId);
  const data = response.json();
  if (data.status === 'error') {
    throw new Error(data.message);
  }
  return data.profile;
}`
  },
  {
    name: "Boundary Array Slice",
    fileName: "rankings.js",
    code: `function getTopRankings(scores, limit) {
  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}`
  }
];

export default function DirectCodeModal({ isOpen, onClose, onRunDirectScan }) {
  const [code, setCode] = useState(SAMPLE_SNIPPETS[0].code);
  const [fileName, setFileName] = useState(SAMPLE_SNIPPETS[0].fileName || 'voting.js');

  if (!isOpen) return null;

  const handleScan = () => {
    if (!code.trim()) return;
    onRunDirectScan(code, fileName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl ui-card shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
              <Terminal className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Code Snippet Analysis
              </h3>
              <p className="text-xs text-[var(--text-muted)]">Paste or test standalone JavaScript / TypeScript functions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-[var(--bg-surface-elevated)]">
          
          {/* Preset Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-[var(--text-muted)] font-medium flex-shrink-0 flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5" /> Benchmarks:
            </span>
            {SAMPLE_SNIPPETS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCode(s.code);
                  if (s.fileName) setFileName(s.fileName);
                }}
                className="px-2.5 py-1 rounded-md bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-all whitespace-nowrap cursor-pointer"
              >
                {s.name}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Function Code Snippet
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)] font-mono">Filename:</span>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="px-2.5 py-1 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--border-strong)]"
                />
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={12}
              placeholder="Paste JavaScript/TypeScript function here..."
              className="w-full p-3.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-md text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] leading-relaxed shadow-inner"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            Automated AST parsing and defect detection
          </span>
          <button
            onClick={handleScan}
            disabled={!code.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--accent-btn-bg)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Analyze Snippet</span>
          </button>
        </div>

      </div>
    </div>
  );
}
