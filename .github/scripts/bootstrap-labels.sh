#!/usr/bin/env bash
# bootstrap-labels.sh
#
# Creates all required GitHub Issue labels for OneSell.
# Run once after repo creation:   bash .github/scripts/bootstrap-labels.sh
#
# Requires: GitHub CLI (gh) authenticated to the repo.
# Usage: bash .github/scripts/bootstrap-labels.sh [--delete-defaults]
#
# Pass --delete-defaults to remove GitHub's default labels (bug, enhancement, etc.)
# before creating the OneSell label set.

set -euo pipefail

REPO="chenning007/OneSell"

echo "→ Bootstrapping labels for $REPO"

# ── Optional: remove GitHub default labels ────────────────────────────────────
if [[ "${1:-}" == "--delete-defaults" ]]; then
  echo "→ Removing GitHub default labels..."
  for label in "bug" "documentation" "duplicate" "enhancement" "good first issue" \
                "help wanted" "invalid" "question" "wontfix"; do
    gh label delete "$label" --repo "$REPO" --yes 2>/dev/null || true
  done
fi

# ── Helper ────────────────────────────────────────────────────────────────────
create_label() {
  local name="$1" color="$2" description="$3"
  if gh label list --repo "$REPO" --json name --jq '.[].name' | grep -qx "$name"; then
    echo "  ↺ exists: $name"
    gh label edit "$name" --repo "$REPO" --color "$color" --description "$description" 2>/dev/null || true
  else
    echo "  + create: $name"
    gh label create "$name" --repo "$REPO" --color "$color" --description "$description"
  fi
}

# ── Role Labels ───────────────────────────────────────────────────────────────
create_label "role:pm"         "0075ca" "Product manager owns this issue"
create_label "role:architect"  "e4e669" "Architect owns this issue"
create_label "role:dev"        "d876e3" "Developer owns this issue"
create_label "role:tester"     "c5def5" "Tester owns this issue"

# ── Epic Labels ───────────────────────────────────────────────────────────────
create_label "epic:foundation"    "f9d0c4" "System architecture, repo setup, strategy"
create_label "epic:wizard"        "fef2c0" "Preference wizard (Steps 1-6)"
create_label "epic:extraction"    "bfd4f2" "Client-side data extraction scripts"
create_label "epic:agent"         "d4c5f9" "LLM agent pipeline (Planner/Executor/Synthesizer)"
create_label "epic:results-ui"    "c2e0c6" "Results dashboard and product detail UI"
create_label "epic:china"         "f29513" "China market extraction and prompts"
create_label "epic:security-nfr"  "b60205" "Security, performance, accessibility"
create_label "epic:monetization"  "0e8a16" "Subscription tiers and access control"

# ── Priority Labels ───────────────────────────────────────────────────────────
create_label "P0" "b60205" "Critical — must ship in current milestone"
create_label "P1" "e4e669" "High — must ship this quarter"
create_label "P2" "c5def5" "Medium — next milestone"
create_label "P3" "ffffff" "Low — nice to have"

# ── Type Labels ───────────────────────────────────────────────────────────────
create_label "type:feature"  "a2eeef" "New capability"
create_label "type:design"   "e4e669" "Architecture or UX design artifact"
create_label "type:test"     "c5def5" "Test plan or test execution"
create_label "type:bug"      "d73a4a" "Something is broken"
create_label "type:question" "d876e3" "Open question blocking progress"
create_label "type:chore"    "ffffff" "Setup, config, tooling"

# ── Status Labels ─────────────────────────────────────────────────────────────
create_label "blocked"                "e11d48" "Blocked — waiting on another role or decision"
create_label "needs-ac"               "fbbf24" "Missing acceptance criteria — PM action required"
create_label "needs-design"           "fbbf24" "Missing architecture spec — Architect action required"
create_label "needs-human-signoff"    "7c3aed" "AI work paused — human owner decision required"

echo ""
echo "✅ Labels bootstrapped for $REPO"
echo ""
echo "Next steps:"
echo "  1. Go to https://github.com/$REPO/milestones and create:"
echo "     M0 — Foundation | M1 — Wizard + Extraction (US) | M2 — Agent + Results"
echo "     M3 — Quality & NFRs | M4 — China Market | M5 — Monetization"
echo "  2. Go to https://github.com/$REPO/projects and create the project board"
echo "     with columns: Backlog | Ready | In Progress | In Review | Done"
echo "  3. Update .github/CODEOWNERS with real GitHub usernames"
