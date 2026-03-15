# bootstrap-labels.ps1
#
# Creates all required GitHub Issue labels for OneSell.
# Uses the GitHub REST API directly — no GitHub CLI required.
#
# USAGE:
#   .\bootstrap-labels.ps1 -Token "ghp_yourPersonalAccessTokenHere"
#
# HOW TO GET A TOKEN:
#   1. Go to https://github.com/settings/tokens
#   2. Click "Generate new token (classic)"
#   3. Give it a name (e.g. "onesell-label-setup")
#   4. Select scopes: repo  (that gives full repo access including labels)
#   5. Click "Generate token" — copy it immediately
#   6. Run this script with that token
#
# OPTIONAL: also remove GitHub's default labels first:
#   .\bootstrap-labels.ps1 -Token "ghp_..." -DeleteDefaults

param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [switch]$DeleteDefaults
)

$Repo  = "chenning007/OneSell"
$BaseUrl = "https://api.github.com/repos/$Repo/labels"
$Headers = @{
    Authorization = "Bearer $Token"
    Accept        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

function Upsert-Label {
    param([string]$Name, [string]$Color, [string]$Description)

    # Check if label already exists
    $existing = $null
    try {
        $encoded = [Uri]::EscapeDataString($Name)
        $existing = Invoke-RestMethod -Uri "$BaseUrl/$encoded" -Headers $Headers -Method Get -ErrorAction Stop
    } catch {
        $existing = $null
    }

    $body = @{ name = $Name; color = $Color; description = $Description } | ConvertTo-Json

    if ($existing) {
        Write-Host "  ↺ update : $Name"
        $encoded = [Uri]::EscapeDataString($Name)
        Invoke-RestMethod -Uri "$BaseUrl/$encoded" -Headers $Headers -Method Patch -Body $body -ContentType "application/json" | Out-Null
    } else {
        Write-Host "  + create : $Name"
        Invoke-RestMethod -Uri $BaseUrl -Headers $Headers -Method Post -Body $body -ContentType "application/json" | Out-Null
    }
}

function Remove-Label {
    param([string]$Name)
    try {
        $encoded = [Uri]::EscapeDataString($Name)
        Invoke-RestMethod -Uri "$BaseUrl/$encoded" -Headers $Headers -Method Delete -ErrorAction Stop | Out-Null
        Write-Host "  - removed: $Name"
    } catch {
        # Label didn't exist — fine
    }
}

Write-Host ""
Write-Host "→ Bootstrapping labels for $Repo"
Write-Host ""

# ── Optional: remove GitHub default labels ────────────────────────────────────
if ($DeleteDefaults) {
    Write-Host "→ Removing GitHub default labels..."
    @("bug","documentation","duplicate","enhancement","good first issue",
      "help wanted","invalid","question","wontfix") | ForEach-Object { Remove-Label $_ }
    Write-Host ""
}

# ── Role Labels ───────────────────────────────────────────────────────────────
Write-Host "→ Role labels"
Upsert-Label "role:pm"        "0075ca" "Product manager owns this issue"
Upsert-Label "role:architect" "e4e669" "Architect owns this issue"
Upsert-Label "role:dev"       "d876e3" "Developer owns this issue"
Upsert-Label "role:tester"    "c5def5" "Tester owns this issue"

# ── Epic Labels ───────────────────────────────────────────────────────────────
Write-Host "→ Epic labels"
Upsert-Label "epic:foundation"   "f9d0c4" "System architecture, repo setup, strategy"
Upsert-Label "epic:wizard"       "fef2c0" "Preference wizard (Steps 1-6)"
Upsert-Label "epic:extraction"   "bfd4f2" "Client-side data extraction scripts"
Upsert-Label "epic:agent"        "d4c5f9" "LLM agent pipeline (Planner/Executor/Synthesizer)"
Upsert-Label "epic:results-ui"   "c2e0c6" "Results dashboard and product detail UI"
Upsert-Label "epic:china"        "f29513" "China market extraction and prompts"
Upsert-Label "epic:security-nfr" "b60205" "Security, performance, accessibility"
Upsert-Label "epic:monetization" "0e8a16" "Subscription tiers and access control"

# ── Priority Labels ───────────────────────────────────────────────────────────
Write-Host "→ Priority labels"
Upsert-Label "P0" "b60205" "Critical — must ship in current milestone"
Upsert-Label "P1" "e4e669" "High — must ship this quarter"
Upsert-Label "P2" "c5def5" "Medium — next milestone"
Upsert-Label "P3" "ffffff" "Low — nice to have"

# ── Type Labels ───────────────────────────────────────────────────────────────
Write-Host "→ Type labels"
Upsert-Label "type:feature"  "a2eeef" "New capability"
Upsert-Label "type:design"   "e4e669" "Architecture or UX design artifact"
Upsert-Label "type:test"     "c5def5" "Test plan or test execution"
Upsert-Label "type:bug"      "d73a4a" "Something is broken"
Upsert-Label "type:question" "d876e3" "Open question blocking progress"
Upsert-Label "type:chore"    "ffffff" "Setup, config, tooling"

# ── Status Labels ─────────────────────────────────────────────────────────────
Write-Host "→ Status labels"
Upsert-Label "blocked"             "e11d48" "Blocked — waiting on another role or decision"
Upsert-Label "needs-ac"            "fbbf24" "Missing acceptance criteria — PM action required"
Upsert-Label "needs-design"        "fbbf24" "Missing architecture spec — Architect action required"
Upsert-Label "needs-human-signoff" "7c3aed" "AI work paused — human owner decision required"

Write-Host ""
Write-Host "✅ Labels bootstrapped for $Repo"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Create milestones at https://github.com/$Repo/milestones"
Write-Host "     M0 — Foundation | M1 — Wizard + Extraction (US) | M2 — Agent + Results"
Write-Host "     M3 — Quality & NFRs | M4 — China Market | M5 — Monetization"
Write-Host "  2. Create a Project Board at https://github.com/$Repo/projects"
Write-Host "     Columns: Backlog | Ready | In Progress | In Review | Done"
Write-Host "  3. Create 4 Environments at https://github.com/$Repo/settings/environments"
Write-Host "     prd-approval | architecture-approval | qa-signoff | release-approval"
Write-Host "     Add @chenning007 as Required Reviewer on each"
Write-Host "  4. Create M0 issues from .github/M0-foundation-issues.md"
Write-Host "  5. Enable branch protection on main (require PR + CI pass + CODEOWNERS)"
