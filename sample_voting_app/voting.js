// ============================================================
//  ONLINE VOTING SYSTEM - JavaScript Logic
//  BUG: Age check uses < 18 (should be > 18)
// ============================================================

let votes = {
  "Candidate A - Ravi Kumar":  0,
  "Candidate B - Priya Shah":  0,
  "Candidate C - Arjun Mehta": 0
};

let selectedCandidate = null;
let currentVoter = "";

// ---- ELIGIBILITY CHECK ----
function checkEligibility() {
  const name = document.getElementById("voterName").value.trim();
  const age  = parseInt(document.getElementById("voterAge").value);
  const vid  = document.getElementById("voterID").value.trim();
  const resultBox = document.getElementById("eligibility-result");

  if (!name || !age || !vid) {
    showResult(resultBox, "⚠️ Please fill in all fields.", "result-ineligible");
    return;
  }
  if (isNaN(age) || age < 1 || age > 120) {
    showResult(resultBox, "⚠️ Please enter a valid age.", "result-ineligible");
    return;
  }

  // ==========================================================
  //  🐛 BUG IS HERE:
  //  Condition says age < 18 → minors are marked as ELIGIBLE!
  //  CORRECT logic: age > 18 (or age >= 18)
  // ==========================================================
  if (age < 18) {
    // BUG: This block should run for age > 18, not age < 18
    currentVoter = name;
    showResult(
      resultBox,
      `✅ Eligible! Welcome, ${name}. You may proceed to vote.`,
      "result-eligible"
    );
    setTimeout(() => openVotingPanel(), 1200);
  } else {
    // BUG: This block should run for age <= 18, not age >= 18
    showResult(
      resultBox,
      `❌ Not Eligible. Voter must be above 18 years. Your age: ${age}`,
      "result-ineligible"
    );
  }
}

// ---- OPEN VOTING PANEL ----
function openVotingPanel() {
  document.getElementById("voting-card").classList.remove("hidden");
  document.getElementById("voter-greeting").textContent =
    `Hello, ${currentVoter}! Select your preferred candidate below.`;
  document.getElementById("voting-card").scrollIntoView({ behavior: "smooth" });
}

// ---- SELECT CANDIDATE ----
function selectCandidate(el, name) {
  document.querySelectorAll(".candidate-card").forEach(c => c.classList.remove("selected"));
  el.classList.add("selected");
  selectedCandidate = name;

  const display = document.getElementById("selected-display");
  display.textContent = `✔ Selected: ${name}`;
  display.classList.remove("hidden");

  document.getElementById("submit-vote-btn").classList.remove("hidden");
}

// ---- SUBMIT VOTE ----
function submitVote() {
  if (!selectedCandidate) return;
  votes[selectedCandidate]++;
  document.getElementById("voting-card").classList.add("hidden");
  showResults();
}

// ---- SHOW RESULTS ----
function showResults() {
  const card = document.getElementById("results-card");
  card.classList.remove("hidden");

  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  let html = "";

  for (const [candidate, count] of Object.entries(votes)) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    html += `
      <div class="result-bar-wrap">
        <div class="result-bar-label">
          <span>${candidate}</span>
          <span>${count} vote${count !== 1 ? "s" : ""} (${pct}%)</span>
        </div>
        <div class="result-bar-bg">
          <div class="result-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  document.getElementById("results-display").innerHTML = html;
  card.scrollIntoView({ behavior: "smooth" });
}

// ---- RESET ----
function resetVoting() {
  document.getElementById("voterName").value = "";
  document.getElementById("voterAge").value  = "";
  document.getElementById("voterID").value   = "";
  document.getElementById("eligibility-result").className = "result-box hidden";
  document.getElementById("voting-card").classList.add("hidden");
  document.getElementById("results-card").classList.add("hidden");
  selectedCandidate = null;
  document.querySelectorAll(".candidate-card").forEach(c => c.classList.remove("selected"));
  document.getElementById("selected-display").classList.add("hidden");
  document.getElementById("submit-vote-btn").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- HELPER ----
function showResult(box, message, cls) {
  box.textContent = message;
  box.className = `result-box ${cls}`;
}
