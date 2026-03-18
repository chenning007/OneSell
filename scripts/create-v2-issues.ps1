#!/usr/bin/env pwsh
# Script to create all v2 PRD issues from the task decomposition table
# Run from repo root: pwsh scripts/create-v2-issues.ps1

$repo = "chenning007/OneSell"

# Milestone mapping: Phase -> milestone number
$milestones = @{ "P0" = "v2.0-P0-MVP"; "P1" = "v2.0-P1-Polish"; "P2" = "v2.0-P2-Enhancement" }

# Track created issue numbers for dependency mapping
$issueMap = @{}

function New-Issue {
    param(
        [string]$TaskId,
        [string]$Title,
        [string]$Role,      # "dev" or "tester"
        [string]$Epic,
        [string]$Priority,
        [string]$Phase,
        [string]$Dependencies,
        [string]$PrdSection,
        [string]$AC
    )

    $type = if ($Role -eq "tester") { "type:test" } else { "type:feature" }
    $roleLabel = "role:$Role"
    $milestone = $milestones[$Phase]

    # Build dependency text
    $depText = ""
    if ($Dependencies -and $Dependencies -ne "—") {
        $depIds = $Dependencies -split ",\s*"
        $depLines = @()
        foreach ($d in $depIds) {
            $d = $d.Trim()
            if ($issueMap.ContainsKey($d)) {
                $depLines += "- Blocked by: #$($issueMap[$d]) ($d)"
            } else {
                $depLines += "- Depends on: $d (not yet created)"
            }
        }
        $depText = "`n## Dependencies`n" + ($depLines -join "`n")
    }

    # Format AC as checklist
    $acItems = $AC -split ';\s*\(\d+\)\s*' | Where-Object { $_ -ne "" }
    # Actually parse (1) (2) etc.
    $acLines = @()
    $acMatches = [regex]::Matches($AC, '\((\d+)\)\s*([^;]+?)(?=\s*;\s*\(\d+\)|$)')
    if ($acMatches.Count -gt 0) {
        foreach ($m in $acMatches) {
            $acLines += "- [ ] $($m.Groups[2].Value.Trim())"
        }
    } else {
        # Fallback: split by semicolons
        foreach ($item in ($AC -split ';\s*')) {
            $item = $item.Trim() -replace '^\(\d+\)\s*', ''
            if ($item) { $acLines += "- [ ] $item" }
        }
    }
    $acText = $acLines -join "`n"

    $body = @"
## Task ID: $TaskId

**PRD Section**: $PrdSection
**Phase**: $Phase
**Epic**: $Epic

## Acceptance Criteria

$acText
$depText

---
*Auto-generated from PRD v2 task decomposition. See ADR-005 for architecture details.*
"@

    $labels = "$roleLabel,$Epic,$Priority,$type"

    Write-Host "Creating: [$TaskId] $Title ..." -ForegroundColor Cyan
    $result = gh issue create --repo $repo --title "[$TaskId] $Title" --body $body --label $labels --milestone $milestone 2>&1
    
    if ($result -match "https://github.com/.+/issues/(\d+)") {
        $num = $Matches[1]
        $issueMap[$TaskId] = $num
        Write-Host "  -> #$num" -ForegroundColor Green
    } else {
        Write-Host "  -> ERROR: $result" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500  # Rate limiting
}

Write-Host "=== Creating v2 PRD Issues ===" -ForegroundColor Yellow
Write-Host "Milestones: P0=v2.0-P0-MVP, P1=v2.0-P1-Polish, P2=v2.0-P2-Enhancement" -ForegroundColor Yellow
Write-Host ""

# ===== PHASE P0: epic:foundation =====

New-Issue -TaskId "F-01" -Title "electron-store integration: create LocalStore wrapper with typed get/set" -Role "dev" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "—" -PrdSection "§12.4" -AC "(1) LocalStore class reads/writes JSON via electron-store; (2) typed methods getProfile(), setProfile(), getPreferences(), setPreferences(); (3) data persists between app restarts; (4) no credentials in stored data (strip-credentials applied)"

New-Issue -TaskId "F-02" -Title "Unit: LocalStore CRUD operations, data persistence, credential stripping" -Role "tester" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-01" -PrdSection "§12.4" -AC "(1) get/set/delete for each data type returns expected values; (2) credential keys are stripped before write; (3) stored data survives simulated restart; (4) empty store returns sensible defaults"

New-Issue -TaskId "F-03" -Title "ApiKeyManager: safeStorage encrypt/decrypt for OpenAI API key" -Role "dev" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "—" -PrdSection "§12.3" -AC "(1) saveKey(key) encrypts via safeStorage.encryptString(); (2) getKey() decrypts and returns key; (3) clearKey() removes stored key; (4) hasKey() returns boolean; (5) key never logged or sent to renderer"

New-Issue -TaskId "F-04" -Title "Unit: ApiKeyManager encrypt/decrypt, clear, status check" -Role "tester" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-03" -PrdSection "§12.3" -AC "(1) saveKey + getKey round-trip produces original key; (2) clearKey + hasKey returns false; (3) getKey with no stored key throws typed error; (4) no key value in any log output"

New-Issue -TaskId "F-05" -Title "API key setup screen: first-launch screen for OpenAI key entry" -Role "dev" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-03" -PrdSection "§12.3" -AC "(1) Screen renders with text input and Get a key link; (2) Save and Continue calls apikey:save IPC; (3) invalid key (empty) shows validation error; (4) on success navigates to Market Selection; (5) screen shown only when apikey:get-status returns false"

New-Issue -TaskId "F-06" -Title "Unit: API key setup screen renders, validates input, calls IPC on save" -Role "tester" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-05" -PrdSection "§12.3" -AC "(1) Renders input and link; (2) empty key shows error; (3) valid key calls IPC mock; (4) navigation fires on success"

New-Issue -TaskId "F-07" -Title "IPC channel refactoring: register all v2 IPC channels with Zod validation" -Role "dev" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-01, F-03" -PrdSection "§12, ADR-005" -AC "(1) All 16 new IPC channels registered in handlers.ts; (2) each handler validates input with Zod schema before processing; (3) invalid payloads return structured error; (4) store/apikey/preferences channels wired to LocalStore/ApiKeyManager"

New-Issue -TaskId "F-08" -Title "Unit: IPC handlers reject invalid payloads, route valid payloads to correct service" -Role "tester" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-07" -PrdSection "ADR-005" -AC "(1) Each channel handler rejects malformed input with Zod error; (2) valid input reaches expected service method; (3) no unhandled promise rejections"

New-Issue -TaskId "F-09" -Title "Remove backend dependency: update pnpm dev to start client without docker-compose or backend" -Role "dev" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-07" -PrdSection "§12.1, §14" -AC "(1) pnpm dev in client starts Electron without errors; (2) no backend process needed; (3) BackendClient is preserved but not invoked at startup; (4) docker-compose.yml unchanged (preserved for Pro+)"

New-Issue -TaskId "F-10" -Title "Integration: app launches with pnpm dev without backend, reaches Market Selection" -Role "tester" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-09" -PrdSection "§12.1" -AC "(1) App window opens; (2) Market Selection screen renders; (3) no network errors for backend endpoints; (4) IPC channels respond"

New-Issue -TaskId "F-11" -Title "electron-builder setup: configure for Windows NSIS + macOS DMG installers" -Role "dev" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-09" -PrdSection "§11" -AC "(1) pnpm dist:win produces .exe installer; (2) pnpm dist:mac produces .dmg; (3) installer bundles all client code, extraction scripts, agent, prompts; (4) no Docker/Node.js bundled; (5) installed app launches to Market Selection"

New-Issue -TaskId "F-12" -Title "Build: verify installer output for Windows (.exe) and macOS (.dmg)" -Role "tester" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-11" -PrdSection "§11" -AC "(1) .exe file produced with expected name pattern; (2) .dmg file produced; (3) installed binary size < 150 MB; (4) installed app opens without error"

New-Issue -TaskId "F-13" -Title "Preload script update: expose v2 IPC channels via contextBridge" -Role "dev" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-07" -PrdSection "ADR-005" -AC "(1) preload.ts exposes all new IPC channel invocations; (2) electron.d.ts type declarations updated to match; (3) no direct Node.js access from renderer"

New-Issue -TaskId "F-14" -Title "Unit: preload exposes expected API surface, type declarations match" -Role "tester" -Epic "epic:foundation" -Priority "P0" -Phase "P0" -Dependencies "F-13" -PrdSection "ADR-005" -AC "(1) window.electronAPI has all v2 methods; (2) type declarations compile without error; (3) IPC invoke calls resolve"

# ===== PHASE P0: epic:agent =====

New-Issue -TaskId "A-01" -Title "Relocate agent service to client: copy PlannerAgent, ExecutorAgent, SynthesizerAgent, ToolRegistry" -Role "dev" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "—" -PrdSection "§12.6, §14" -AC "(1) All agent source files present in main/agent/; (2) imports updated to local paths; (3) no dependency on onesell-backend packages; (4) TypeScript compiles without errors"

New-Issue -TaskId "A-02" -Title "Unit: relocated agent modules compile and tool functions produce same outputs" -Role "tester" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "A-01" -PrdSection "§12.6" -AC "(1) All 7 tool functions pass existing unit tests in client context; (2) PlannerAgent/ExecutorAgent/SynthesizerAgent classes instantiate without error; (3) ToolRegistry registers all tools"

New-Issue -TaskId "A-03" -Title "Relocate market prompts to client: copy all prompt files to main/agent/prompts/" -Role "dev" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "A-01" -PrdSection "§12.6, §14" -AC "(1) All market prompts present; (2) MarketPromptStore resolves prompts by marketId; (3) no changes to prompt content"

New-Issue -TaskId "A-04" -Title "Unit: MarketPromptStore resolves prompts for us, cn markets" -Role "tester" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "A-03" -PrdSection "§12.6" -AC "(1) getPrompt(us) returns non-empty prompt; (2) getPrompt(cn) returns Chinese-market prompt; (3) unknown marketId returns fallback or throws typed error"

New-Issue -TaskId "A-05" -Title "ClientLLMProvider: implement direct OpenAI API calls using user API key from safeStorage" -Role "dev" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "F-03, A-01" -PrdSection "§12.3, §12.6" -AC "(1) ClientLLMProvider implements LLMProvider interface; (2) calls OpenAI API with key from ApiKeyManager; (3) handles rate limit / auth errors with typed responses; (4) enforces token budget limit per request; (5) key never logged"

New-Issue -TaskId "A-06" -Title "Unit: ClientLLMProvider calls OpenAI with correct headers, handles errors, enforces token budget" -Role "tester" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "A-05" -PrdSection "§12.3" -AC "(1) Mocked HTTP call includes correct Authorization header; (2) rate limit error returns typed error; (3) auth error returns typed error; (4) token count exceeding budget rejects request; (5) no API key in test outputs"

New-Issue -TaskId "A-07" -Title "AgentService orchestration: wire Plan-Execute-Synthesize pipeline in main process with IPC push" -Role "dev" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "A-05, A-03, F-07" -PrdSection "§12.6" -AC "(1) agent:run-analysis IPC triggers full pipeline; (2) agent:analysis-status pushed at each phase; (3) agent:analysis-result pushed with AnalysisResult on completion; (4) errors handled gracefully with error status"

New-Issue -TaskId "A-08" -Title "Integration: full agent pipeline runs with mocked LLM, produces AnalysisResult via IPC" -Role "tester" -Epic "epic:agent" -Priority "P0" -Phase "P0" -Dependencies "A-07" -PrdSection "§12.6" -AC "(1) IPC trigger starts pipeline; (2) status updates received in correct order; (3) final result contains categories[] with ProductCandidate[]; (4) all numeric scores come from tool functions; (5) error case returns error status"

# ===== PHASE P0: epic:wizard =====

New-Issue -TaskId "W-01" -Title "Shared types: update UserPreferences interface for v2" -Role "dev" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "—" -PrdSection "§3.3" -AC "(1) UserPreferences no longer has targetPlatforms or categories fields; (2) productType and fulfillmentTime are optional with documented defaults; (3) TypeScript compiles across client and backend"

New-Issue -TaskId "W-02" -Title "Contract: UserPreferences Zod schema handles new shape, rejects old fields" -Role "tester" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-01" -PrdSection "§3.3" -AC "(1) Schema validates payload with defaults; (2) schema validates payload with explicit preferences; (3) payload with removed fields accepted; (4) invalid types rejected"

New-Issue -TaskId "W-03" -Title "Shared types: define ProductCandidate, CandidateCategory, AnalysisResult interfaces + Zod schemas" -Role "dev" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "—" -PrdSection "§8, ADR-005" -AC "(1) ProductCandidate extends ProductCard with oneLineReason, whyBullets, sourcePlatforms; (2) CandidateCategory groups candidates; (3) AnalysisResult wraps categories; (4) Zod schemas validate all types"

New-Issue -TaskId "W-04" -Title "Contract: AnalysisResult Zod schema validates category groups, candidates, reasoning fields" -Role "tester" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-03" -PrdSection "§8, ADR-005" -AC "(1) Valid AnalysisResult with 3 categories passes; (2) candidate missing oneLineReason fails; (3) empty categories array passes (graceful degradation)"

New-Issue -TaskId "W-05" -Title "wizardStore v2: simplify state, remove selectedPlatforms, add hasProfile flag, update step numbering" -Role "dev" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-01" -PrdSection "§3.4, §9" -AC "(1) currentStep defaults 0 if profile exists, 1 if not; (2) selectedPlatforms removed; (3) hasProfile populated from store:get-profile IPC; (4) setStep validated against 0-5 range"

New-Issue -TaskId "W-06" -Title "Unit: wizardStore step transitions, profile detection, no selectedPlatforms field" -Role "tester" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-05" -PrdSection "§3.4" -AC "(1) Initial step is 0 when profile exists; (2) initial step is 1 when no profile; (3) selectedPlatforms is undefined; (4) setStep(6) is rejected"

New-Issue -TaskId "W-07" -Title "App.tsx v2 routing: update screen mapping to 6 screens (steps 0-5)" -Role "dev" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-05" -PrdSection "§9" -AC "(1) Step 0 -> QuickStartScreen; (2) Step 1 -> MarketSelection; (3) Step 2 -> ExtractionDashboard; (4) Step 3 -> AgentAnalysisScreen; (5) Step 4 -> ResultsDashboardV2; (6) Step 5 -> ProductDetail; (7) old imports removed"

New-Issue -TaskId "W-08" -Title "Unit: App.tsx renders correct component for each step 0-5" -Role "tester" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-07" -PrdSection "§9" -AC "(1) Each step renders expected component; (2) step outside 0-5 renders fallback; (3) no reference to removed Wizard/DataSourceConnect/ProgressScreen"

New-Issue -TaskId "W-09" -Title "MarketSelection v2: after market selection, skip to Extraction Dashboard, auto-select all platforms" -Role "dev" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-05" -PrdSection "§3.2, §3.4" -AC "(1) Selecting a market sets wizardStore.market; (2) sets step to 2 (Extraction Dashboard); (3) platforms derived from MARKET_CONFIGS[marketId].platforms; (4) profile saved after extraction starts"

New-Issue -TaskId "W-10" -Title "Unit: MarketSelection navigates to step 2, no platform selection UI, platforms auto-derived" -Role "tester" -Epic "epic:wizard" -Priority "P0" -Phase "P0" -Dependencies "W-09" -PrdSection "§3.2" -AC "(1) Clicking a market tile updates market and sets step to 2; (2) no checkbox/platform selection UI rendered; (3) market.platforms matches MARKET_CONFIGS"

# ===== PHASE P0: epic:extraction =====

New-Issue -TaskId "E-01" -Title "extractionStore v2: new PipelineTask[] model with status, label, toggle, progress events" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "W-01" -PrdSection "§5.3, §5.4, ADR-005" -AC "(1) PipelineTask interface with status, label, doneLabel, productCount, enabled, requiresAuth, progressEvents; (2) initPipeline(marketId) creates tasks from MARKET_CONFIGS; (3) updateTask(platformId, update) merges partial state; (4) canAnalyze computed: true when >= 1 task is done"

New-Issue -TaskId "E-02" -Title "Unit: extractionStore pipeline initialization, task updates, canAnalyze computation" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-01" -PrdSection "§5.3" -AC "(1) initPipeline(us) creates tasks for all US platforms; (2) setting one task done makes canAnalyze true; (3) disabling a task sets status to disabled; (4) all tasks done/skipped/error triggers allDone"

New-Issue -TaskId "E-03" -Title "ExtractionDashboard container: header + TaskPipeline + PlatformTabPanel + footer" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-01, W-07" -PrdSection "§5.3" -AC "(1) Renders market badge in header; (2) TaskPipeline visible at top; (3) PlatformTabPanel below; (4) Cancel and Analyze Now buttons in footer; (5) Analyze Now disabled until canAnalyze is true; (6) gear icon opens AdvancedPreferencesDrawer"

New-Issue -TaskId "E-04" -Title "Unit: ExtractionDashboard renders all sections, buttons disabled/enabled correctly" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-03" -PrdSection "§5.3" -AC "(1) Header shows market name; (2) TaskPipeline rendered; (3) PlatformTabPanel rendered; (4) Analyze Now disabled when 0 platforms done; (5) Analyze Now enabled when >= 1 done"

New-Issue -TaskId "E-05" -Title "TaskPipeline component: renders rows per platform with status icon, text, overall progress" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-01" -PrdSection "§5.4" -AC "(1) One row per pipeline task; (2) status icon matches state; (3) text shows label for queued, doneLabel for done; (4) overall progress shows N of M platforms done; (5) animated spinner for active platform"

New-Issue -TaskId "E-06" -Title "Unit: TaskPipeline renders correct icons and text for each status state" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-05" -PrdSection "§5.4" -AC "(1) done row shows checkmark and product count; (2) active row shows spinner with animation; (3) needs-login shows lock icon; (4) overall progress counts correct"

New-Issue -TaskId "E-07" -Title "TaskPipelineRow: individual row with status icon, descriptive text, toggle switch" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-05" -PrdSection "§5.4, §5.8" -AC "(1) Row renders platform name + descriptive text; (2) toggle switch on right edge; (3) toggling off dispatches extraction:toggle-platform IPC; (4) disabled row shows grey Disabled by you"

New-Issue -TaskId "E-08" -Title "Unit: TaskPipelineRow toggle dispatches IPC, disabled state renders correctly" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-07" -PrdSection "§5.8" -AC "(1) Toggle click calls IPC mock; (2) disabled row shows Disabled by you; (3) enabled row shows status text"

New-Issue -TaskId "E-09" -Title "PlatformTabPanel: tab bar + content area, tabs match pipeline tasks, auto-follow extraction" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-01" -PrdSection "§5.5" -AC "(1) Tab bar with one tab per platform; (2) clicking tab selects it and shows content; (3) active extraction platform tab auto-selected; (4) manual selection overrides auto-select; (5) tab icon matches platform status"

New-Issue -TaskId "E-10" -Title "Unit: PlatformTabPanel tab selection, auto-follow, manual override" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-09" -PrdSection "§5.5" -AC "(1) Clicking tab renders its content; (2) active platform auto-selected on mount; (3) manual click persists selection; (4) tab icons match status"

New-Issue -TaskId "E-11" -Title "PlatformTab content: renders webview region, login prompt, queued message, done summary based on status" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-09, F-07" -PrdSection "§5.5" -AC "(1) needs-login: shows Please log in banner + webview; (2) queued: shows waiting message; (3) active: shows webview + mini extraction log; (4) done: shows summary card with product count; (5) skipped: shows Skipped message"

New-Issue -TaskId "E-12" -Title "Unit: PlatformTab renders correct content for each status state" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-11" -PrdSection "§5.5" -AC "(1) Each of 5 states renders expected content; (2) login banner has expected text; (3) done summary shows product count"

New-Issue -TaskId "E-13" -Title "ExtractionManager v2: extend with attachToRegion for tab-panel positioning and startAutonomousExtraction" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "F-07" -PrdSection "§5.2, §5.6, ADR-005" -AC "(1) attachToRegion positions BrowserView within given bounds; (2) startAutonomousExtraction orchestrates platform sequence; (3) emits extraction:pipeline-update via IPC; (4) emits extraction:progress-event per field"

New-Issue -TaskId "E-14" -Title "Integration: ExtractionManager attaches views to region bounds, orchestrates extraction sequence" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-13" -PrdSection "§5.6" -AC "(1) View positioned within specified bounds; (2) public platforms extracted before auth-required; (3) pipeline-update events emitted in correct order; (4) partial completion still proceeds"

New-Issue -TaskId "E-15" -Title "useAutonomousExtraction hook: starts extraction on mount, listens to IPC updates, syncs to extractionStore" -Role "dev" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-01, E-13" -PrdSection "§5.2" -AC "(1) Hook calls extraction:start-pipeline on mount; (2) listens to extraction:pipeline-update and updates store; (3) listens to extraction:progress-event and appends to task; (4) cleanup removes listeners on unmount"

New-Issue -TaskId "E-16" -Title "Unit: useAutonomousExtraction dispatches start, processes IPC updates, cleans up" -Role "tester" -Epic "epic:extraction" -Priority "P0" -Phase "P0" -Dependencies "E-15" -PrdSection "§5.2" -AC "(1) Mount triggers IPC start call; (2) simulated IPC update changes store; (3) unmount removes listeners"

# ===== PHASE P0: epic:results-ui =====

New-Issue -TaskId "R-01" -Title "analysisStore v2: add categories field, update setResults to accept AnalysisResult" -Role "dev" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "W-03" -PrdSection "§8, ADR-005" -AC "(1) Store has categories field; (2) setResults(analysisResult) populates categories; (3) reset() clears categories; (4) backward-compatible: flat results array still populated from all candidates"

New-Issue -TaskId "R-02" -Title "Unit: analysisStore populates categories, flat results array, resets correctly" -Role "tester" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-01" -PrdSection "§8" -AC "(1) Setting results populates both categories and results; (2) reset clears both; (3) empty categories handled gracefully"

New-Issue -TaskId "R-03" -Title "ResultsDashboardV2: container with category groups, actions bar (Re-analyze, Export CSV, Save)" -Role "dev" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-01, W-07" -PrdSection "§8.1, §8.5" -AC "(1) Renders one CategoryGroup per CandidateCategory; (2) actions bar with Re-analyze, Export CSV, Save to My List buttons; (3) Re-analyze triggers agent:run-analysis IPC; (4) Export CSV downloads file; (5) gear icon opens preferences drawer"

New-Issue -TaskId "R-04" -Title "Unit: ResultsDashboardV2 renders category groups, action buttons trigger correct handlers" -Role "tester" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-03" -PrdSection "§8.1" -AC "(1) N categories -> N CategoryGroup components; (2) Export CSV creates blob download; (3) Re-analyze calls IPC mock; (4) empty categories shows no results message"

New-Issue -TaskId "R-05" -Title "CategoryGroup: collapsible header with category name + count, list of CandidateRow children" -Role "dev" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-03" -PrdSection "§8.2" -AC "(1) Header shows category name + product count; (2) clicking header collapses/expands; (3) expanded by default; (4) CandidateRow rendered for each candidate"

New-Issue -TaskId "R-06" -Title "Unit: CategoryGroup collapses/expands, shows correct count, renders rows" -Role "tester" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-05" -PrdSection "§8.2" -AC "(1) Click header toggles visibility; (2) count matches candidates.length; (3) candidate rows visible when expanded"

New-Issue -TaskId "R-07" -Title "CandidateRow: rank, product name, score, one-line reason; click expands to CandidateDetail" -Role "dev" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-05" -PrdSection "§8.3" -AC "(1) Shows rank #N, product name, score badge, one-line reason; (2) clicking row expands inline CandidateDetail; (3) Detail button navigates to full ProductDetail (step 5)"

New-Issue -TaskId "R-08" -Title "Unit: CandidateRow displays all fields, expand/collapse works, Detail navigates" -Role "tester" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-07" -PrdSection "§8.3" -AC "(1) Name, score, reason visible; (2) click toggles CandidateDetail; (3) Detail click sets step to 5 and selectedCardId"

New-Issue -TaskId "R-09" -Title "CandidateDetail: Why this product bullets, score breakdown bars, source platforms, risk flags" -Role "dev" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-07" -PrdSection "§8.3" -AC "(1) Renders 3-5 Why bullets from whyBullets; (2) score breakdown as horizontal bars (demand, competition, margin, trend); (3) source platforms with data points; (4) risk flags with warning icon; (5) suggested next steps"

New-Issue -TaskId "R-10" -Title "Unit: CandidateDetail renders bullets, score bars, platforms, risk flags" -Role "tester" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-09" -PrdSection "§8.3" -AC "(1) 4 whyBullets produce 4 list items; (2) score bars have correct widths; (3) 2 source platforms produce 2 platform rows; (4) risk flags show correct severity color"

New-Issue -TaskId "R-11" -Title "Auto-transition from extraction to analysis: 3-second countdown banner, then navigate to step 3" -Role "dev" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "E-03" -PrdSection "§7.2" -AC "(1) When all platforms done, countdown banner appears; (2) counts down from 3; (3) auto-navigates to step 3 after countdown; (4) Analyze Now click skips countdown"

New-Issue -TaskId "R-12" -Title "Unit: countdown banner appears on allDone, navigates after 3 seconds" -Role "tester" -Epic "epic:results-ui" -Priority "P0" -Phase "P0" -Dependencies "R-11" -PrdSection "§7.2" -AC "(1) Banner appears when allDone true; (2) step changes to 3 after timeout; (3) early click skips countdown"

# ===== PHASE P1: epic:wizard =====

New-Issue -TaskId "W-11" -Title "QuickStartScreen: displays saved profile, Go button, Change Market link, Clear profile link" -Role "dev" -Epic "epic:wizard" -Priority "P1" -Phase "P1" -Dependencies "F-01, W-05" -PrdSection "§4.2" -AC "(1) Shows market flag + name + platforms list + last session date; (2) Go loads profile and navigates to step 2; (3) Change Market navigates to step 1; (4) Clear profile calls store:clear-profile IPC and navigates to step 1; (5) only shown when hasProfile is true"

New-Issue -TaskId "W-12" -Title "Unit: QuickStartScreen renders profile data, Go/Change/Clear buttons work" -Role "tester" -Epic "epic:wizard" -Priority "P1" -Phase "P1" -Dependencies "W-11" -PrdSection "§4.2" -AC "(1) Market name and platforms displayed; (2) Go sets step to 2 and loads market; (3) Clear calls IPC mock and sets step to 1"

New-Issue -TaskId "W-13" -Title "Profile auto-save: save profile to electron-store when user starts extraction" -Role "dev" -Epic "epic:wizard" -Priority "P1" -Phase "P1" -Dependencies "F-01, E-15" -PrdSection "§4.3" -AC "(1) Profile saved when extraction:start-pipeline IPC is called; (2) saved profile contains marketId, lastSessionAt, advancedPreferences; (3) profile not saved on market selection alone"

New-Issue -TaskId "W-14" -Title "Unit: profile saved on extraction start, not on market selection" -Role "tester" -Epic "epic:wizard" -Priority "P1" -Phase "P1" -Dependencies "W-13" -PrdSection "§4.3" -AC "(1) Market selection does not save profile; (2) extraction start saves profile; (3) saved profile has correct fields"

New-Issue -TaskId "W-15" -Title "AdvancedPreferencesDrawer: slide-out drawer with Budget slider, ProductType toggle, FulfillmentTime radio" -Role "dev" -Epic "epic:wizard" -Priority "P1" -Phase "P1" -Dependencies "W-01" -PrdSection "§10" -AC "(1) Drawer opens from gear icon; (2) Budget slider with market-aware currency; (3) ProductType physical/digital toggle; (4) Fulfillment radio cards; (5) Apply closes drawer and triggers re-analysis if on Results; (6) Reset to Defaults button; (7) 400px wide slide-out from right"

New-Issue -TaskId "W-16" -Title "Unit: AdvancedPreferencesDrawer renders all inputs, Apply/Reset work" -Role "tester" -Epic "epic:wizard" -Priority "P1" -Phase "P1" -Dependencies "W-15" -PrdSection "§10" -AC "(1) All 3 preference inputs rendered; (2) changing value updates store; (3) Apply closes drawer; (4) Reset restores defaults; (5) currency matches market"

# ===== PHASE P1: epic:extraction =====

New-Issue -TaskId "E-17" -Title "ExtractionLog component: per-platform mini-log showing field extraction progress" -Role "dev" -Epic "epic:extraction" -Priority "P1" -Phase "P1" -Dependencies "E-01" -PrdSection "§6.2, §6.3" -AC "(1) Shows list of extraction fields with status icons; (2) fields driven by ExtractionProgressEvent[] from store; (3) total count summary at bottom; (4) updates in real-time as events arrive"

New-Issue -TaskId "E-18" -Title "Unit: ExtractionLog renders correct icons per field state, updates on new events" -Role "tester" -Epic "epic:extraction" -Priority "P1" -Phase "P1" -Dependencies "E-17" -PrdSection "§6.3" -AC "(1) 3 done fields produce 3 checkmark rows; (2) 1 scanning field produces spinner with animation; (3) new event appended updates display; (4) total count correct"

New-Issue -TaskId "E-19" -Title "Extraction progress events: update extraction scripts to emit ExtractionProgressEvent callbacks" -Role "dev" -Epic "epic:extraction" -Priority "P1" -Phase "P1" -Dependencies "E-13" -PrdSection "§6.3, §14" -AC "(1) ExtractionScript interface extended with optional onProgress callback; (2) at minimum each script emits started and done events; (3) ExtractionManager wires callback and forwards events via IPC"

New-Issue -TaskId "E-20" -Title "Unit: extraction scripts emit started/done events, ExtractionManager forwards them" -Role "tester" -Epic "epic:extraction" -Priority "P1" -Phase "P1" -Dependencies "E-19" -PrdSection "§6.3" -AC "(1) Script emits at least 2 events; (2) Manager forwards events via IPC; (3) event has correct platformId and status"

New-Issue -TaskId "E-21" -Title "Auto-login detection: detect when user has authenticated in a platform tab" -Role "dev" -Epic "epic:extraction" -Priority "P1" -Phase "P1" -Dependencies "E-13" -PrdSection "§5.7, §13" -AC "(1) ExtractionManager polls BrowserView URL/cookies after login page loads; (2) on successful login detection, status changes from needs-login to queued; (3) platform auto-joins extraction queue; (4) banner confirms Ready"

New-Issue -TaskId "E-22" -Title "Integration: login detection changes status, platform joins queue" -Role "tester" -Epic "epic:extraction" -Priority "P1" -Phase "P1" -Dependencies "E-21" -PrdSection "§5.7" -AC "(1) Simulated login changes status; (2) platform enters queue; (3) extraction proceeds after login"

# ===== PHASE P1: epic:foundation =====

New-Issue -TaskId "F-15" -Title "Session history: store last 10 analysis sessions in electron-store, browsable from Results" -Role "dev" -Epic "epic:foundation" -Priority "P1" -Phase "P1" -Dependencies "F-01, R-01" -PrdSection "§12.4, §13" -AC "(1) After analysis completes, session saved to history; (2) history stores last 10 sessions (FIFO); (3) history items include market, date, category count, top candidate name; (4) history browsable from Results via dropdown"

New-Issue -TaskId "F-16" -Title "Unit: session history saves, caps at 10, renders list" -Role "tester" -Epic "epic:foundation" -Priority "P1" -Phase "P1" -Dependencies "F-15" -PrdSection "§12.4" -AC "(1) History saves new session; (2) 11th session evicts oldest; (3) history list renders correct items"

New-Issue -TaskId "I-01" -Title "i18n: add all new v2 strings for Extraction Dashboard, Results, Quick Start, API key, Preferences" -Role "dev" -Epic "epic:foundation" -Priority "P1" -Phase "P1" -Dependencies "E-03, R-03, W-11, F-05" -PrdSection "§5, §8, §4, §12" -AC "(1) All new UI strings have i18n keys; (2) keys resolve for en, zh-CN, de, ja; (3) no hardcoded user-facing strings in v2 components"

New-Issue -TaskId "I-02" -Title "Unit: all new i18n keys resolve for all supported locales" -Role "tester" -Epic "epic:foundation" -Priority "P1" -Phase "P1" -Dependencies "I-01" -PrdSection "—" -AC "(1) Each new key defined in all locale files; (2) no missing translations produce fallback text"

# ===== PHASE P2: epic:extraction =====

New-Issue -TaskId "E-23" -Title "ExtractionScript v2 interface: add getAutoDiscoveryUrls() method returning URL sequence with labels" -Role "dev" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-13" -PrdSection "§5.6, §14" -AC "(1) ExtractionScript interface has getAutoDiscoveryUrls(); (2) backward compatible: old scripts return empty array; (3) ExtractionManager uses auto-discovery URLs when available, falls back to getNavigationTargets"

New-Issue -TaskId "E-24" -Title "Contract: ExtractionScript with getAutoDiscoveryUrls, backward compat with old scripts" -Role "tester" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-23" -PrdSection "§14" -AC "(1) New script with URLs works; (2) old script without method returns empty array; (3) ExtractionManager handles both"

New-Issue -TaskId "E-25" -Title "Implement getAutoDiscoveryUrls for US market scripts: amazon-us, google-trends" -Role "dev" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-23" -PrdSection "§5.6" -AC "(1) amazon-us returns Best Sellers, Movers and Shakers, New Releases URLs; (2) google-trends returns auto-query URLs for top 20 categories; (3) URLs are valid and navigable"

New-Issue -TaskId "E-26" -Title "Unit: US market scripts return correct auto-discovery URLs" -Role "tester" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-25" -PrdSection "§5.6" -AC "(1) amazon-us URLs include Best Sellers page; (2) google-trends URLs include category queries; (3) all URLs are well-formed https://"

New-Issue -TaskId "E-27" -Title "Implement getAutoDiscoveryUrls for CN market scripts: taobao, jd, 1688" -Role "dev" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-23" -PrdSection "§5.6" -AC "(1) taobao returns hot sellers and trending searches URLs; (2) jd returns rankings and new arrivals URLs; (3) 1688 returns supplier search URLs"

New-Issue -TaskId "E-28" -Title "Unit: CN market scripts return correct auto-discovery URLs" -Role "tester" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-27" -PrdSection "§5.6" -AC "(1) taobao URLs include hot sellers page; (2) jd URLs include rankings; (3) all URLs well-formed"

New-Issue -TaskId "E-29" -Title "Time estimate display: calculate and show estimated extraction time per platform in pipeline row" -Role "dev" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-05" -PrdSection "§13" -AC "(1) Each pipeline row shows estimated time; (2) overall progress shows total estimate; (3) estimate updates as platforms complete"

New-Issue -TaskId "E-30" -Title "Unit: time estimates display in pipeline rows and overall progress" -Role "tester" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-29" -PrdSection "§13" -AC "(1) Estimate shown per row; (2) overall estimate shown; (3) estimate decreases as platforms complete"

New-Issue -TaskId "E-31" -Title "Tab panel collapse/expand: chevron button to collapse webview tabs, show only TaskPipeline" -Role "dev" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-09" -PrdSection "§5.5" -AC "(1) Chevron button on tab panel header; (2) clicking collapses panel, TaskPipeline takes full height; (3) click again expands; (4) collapse state persisted in session"

New-Issue -TaskId "E-32" -Title "Unit: tab panel collapse/expand toggle, state preserved" -Role "tester" -Epic "epic:extraction" -Priority "P2" -Phase "P2" -Dependencies "E-31" -PrdSection "§5.5" -AC "(1) Click collapses; (2) click restores; (3) state persists during session"

# ===== PHASE P2: epic:wizard =====

New-Issue -TaskId "W-17" -Title "Profile management: clear/edit saved profile from settings menu" -Role "dev" -Epic "epic:wizard" -Priority "P2" -Phase "P2" -Dependencies "W-11" -PrdSection "§13" -AC "(1) Settings icon in header opens menu; (2) Clear Profile deletes profile and returns to step 1; (3) Edit Preferences opens AdvancedPreferencesDrawer"

New-Issue -TaskId "W-18" -Title "Unit: settings menu renders, clear profile works, edit opens drawer" -Role "tester" -Epic "epic:wizard" -Priority "P2" -Phase "P2" -Dependencies "W-17" -PrdSection "§13" -AC "(1) Menu renders; (2) clear calls IPC; (3) edit opens drawer"

# ===== PHASE P2: epic:foundation =====

New-Issue -TaskId "F-17" -Title "Auto-updater: integrate electron-updater for seamless app updates" -Role "dev" -Epic "epic:foundation" -Priority "P2" -Phase "P2" -Dependencies "F-11" -PrdSection "§11.6" -AC "(1) electron-updater checks for updates on app start; (2) downloads update in background; (3) prompts user to restart to install; (4) code-signing verification enforced"

New-Issue -TaskId "F-18" -Title "Integration: auto-updater checks for updates, prompts restart" -Role "tester" -Epic "epic:foundation" -Priority "P2" -Phase "P2" -Dependencies "F-17" -PrdSection "§11.6" -AC "(1) Update check fires on start; (2) mock update available triggers download; (3) restart prompt shown"

# ===== PHASE P2: epic:results-ui =====

New-Issue -TaskId "R-13" -Title "Save to My List: save current analysis results to local electron-store history" -Role "dev" -Epic "epic:results-ui" -Priority "P2" -Phase "P2" -Dependencies "F-01, R-01" -PrdSection "§8.5" -AC "(1) Save to My List button saves all categories + candidates to LocalStore; (2) saved list retrievable from session history; (3) timestamp and market recorded"

New-Issue -TaskId "R-14" -Title "Unit: save persists results, retrieval returns saved data" -Role "tester" -Epic "epic:results-ui" -Priority "P2" -Phase "P2" -Dependencies "R-13" -PrdSection "§8.5" -AC "(1) Save stores data; (2) retrieval returns same categories; (3) market and date correct"

Write-Host ""
Write-Host "=== Done! Created $($issueMap.Count) issues ===" -ForegroundColor Green
Write-Host "Issue map:" -ForegroundColor Yellow
$issueMap.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Host "  $($_.Name) -> #$($_.Value)" }
