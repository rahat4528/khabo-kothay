# Fix Log & Safety Net Tracker — Khabo Kothay?
# Protocol: Section 2 Safety-Net Protocol

## Overview
Tracking the execution and verification of Five Quality Fixes:
1. Fix 1: Confusing Icons: Clean Bottom Bar and Menu
2. Fix 2: Screen Freezes After a Tap: Optimistic UI
3. Fix 3: Pages Load Everything at Once: Pagination
4. Fix 4: Too Many Database Calls: N+1 Queries (and N+1 Google Calls)
5. Fix 5: Users Stuck Waiting: Background Jobs

---

## Fix 1: Confusing Icons: Clean Bottom Bar and Menu
- **Status**: Plan submitted (Waiting for user approval "go ahead")
- **Branch**: `fix/1-clean-bottom-bar-and-menu` (to be created upon approval)
- **Baseline Test Result**: Pending approval
- **Verification Result**: Pending
- **Commit Hash**: Pending
- **Undo Command**: `git revert <hash>` (Pending)

---

# 15 Features Upgrade Phase Log (Section 0 & 26 Protocol)

## Phase 0: Master Audit & Baseline Verification
- **Status**: Completed & Verified
- **Branch**: `feat/phase-0-audit`
- **Baseline Test Result**: 
  - Node.js (Vitest): 159/159 tests passed across 25 suites (Duration: 9.37s)
  - Python (Pytest): 4/4 tests passed (86% coverage, Duration: 3.39s)
  - Android: Java 17 Temurin detected, unit tests mapped
- **Verification Result**: Verified live Render backend (`https://khabo-kothay-backend.onrender.com`), inspected all existing engines and data stores, created `docs/UPGRADE_AUDIT.md`.
- **Commit Hash**: 2cb61bb
- **Tag**: `phase-0-audit`
- **Undo Command**: `git revert 2cb61bb`

## Phase 1A: Safety Net (Shared Foundations, F14 Remote Flags, F1 Update Checker)
- **Status**: Completed & Verified
- **Branch**: `feat/1a-safety-net`
- **Baseline Test Result**: 169/169 tests passed across 26 suites
- **Verification Result**: Tested remote feature flags, stable hash assignment, What's New release metadata, and server HTTP 426 upgrade required enforcement.
- **Commit Hash**: `ef6306e`
- **Tag**: `phase-1a-safety-net`
- **Undo Command**: `git revert ef6306e`

## Phase 1B: Diagnostics (F15 Consented Crash Reports & Problem Reports)
- **Status**: Completed & Verified
- **Branch**: `feat/1b-diagnostics`
- **Baseline Test Result**: 176/176 tests passed across 27 suites
- **Verification Result**: Verified explicit opt-in consent, secret/PII redaction, stack trace fingerprinting, problem report reference numbers, and admin diagnostics dashboard.
- **Commit Hash**: `781e1ca`
- **Tag**: `phase-1b-diagnostics`
- **Undo Command**: `git revert 781e1ca`

## Phase 2: Search (F3 Ask In Your Own Words)
- **Status**: Completed & Verified
- **Branch**: `feat/2-search-ask`
- **Baseline Test Result**: 183/183 tests passed across 28 suites
- **Verification Result**: Verified 3 canonical Section 6 examples, 65-item labeled corpus (90.8% accuracy in docs/ASK_PARSER.md), ambiguity detection, voice input helper, and search confirmation API.
- **Commit Hash**: `2c43a55`
- **Tag**: `phase-2-search`
- **Undo Command**: `git revert 2c43a55`

## Phase 3: Fare (F2 Fare Check & Estimation Service)
- **Status**: Completed & Verified
- **Branch**: `feat/3-fare-check`
- **Baseline Test Result**: 192/192 tests passed across 29 suites
- **Verification Result**: Verified distance bands, reference range calculations, MAD outlier trimming, user quote comparison ("below", "within", "above"), and community reporting with duplicate prevention.
- **Commit Hash**: `e2cc9e5`
- **Tag**: `phase-3-fare`
- **Undo Command**: `git revert e2cc9e5`

## Phase 4: Discovery & Group (F4 Group Mode, F5 Swipe, F6 Dish Prices, F8 Diet, F7 Rain)
- **Status**: Completed & Verified
- **Branch**: `feat/4-discovery-group`
- **Baseline Test Result**: 199/199 tests passed across 30 suites
- **Verification Result**: Verified 128-bit unguessable tokens, fair multi-origin travel ranking algorithm (docs/GROUP_RANKING.md), voting/closing flow, community dish prices, and dietary disclaimers.
- **Commit Hash**: `6bb8946`
- **Tag**: `phase-4-discovery`
- **Undo Command**: `git revert 6bb8946`

## Phase 5: Convenience (F9 Lunch Reminder, F10 Share Trip, F11 Pay-Me, F12 Simple, F13 Food Story)
- **Status**: Completed & Verified
- **Branch**: `feat/5-convenience`
- **Baseline Test Result**: 199/199 tests passed across 30 suites; Android helpers verified
- **Verification Result**: Verified WorkManager lunch alerts (zero background GPS), public directions trip sharing, encrypted local-only bKash/Nagad wallet lines, Simple Mode toggle, and on-device Food Story recaps.
- **Commit Hash**: `1105e9f`
- **Tag**: `phase-5-convenience`
- **Undo Command**: `git revert 1105e9f`

## Phase 6: Hardening & Verification
- **Status**: Completed & Verified
- **Branch**: `feat/6-hardening`
- **Baseline Test Result**: 203/203 total passing tests (Vitest 199/199, Pytest 4/4 with 86% coverage)
- **Verification Result**: Verified comprehensive Privacy Matrix (docs/PRIVACY_MATRIX.md) covering all 15 features and full test report (docs/TEST_REPORT.md).
- **Commit Hash**: `62195db`
- **Tag**: `phase-6-hardening`
- **Undo Command**: `git revert 62195db`

## Phase 7: Roadmap (Future Features Documentation)
- **Status**: Completed & Verified
- **Branch**: `feat/7-roadmap`
- **Verification Result**: Documented architectural prerequisites in docs/ROADMAP.md for Card & Wallet Offers, Multi-Stop Outing Planner, and Delivery Integration per Section 19.
- **Commit Hash**: `f624306`
- **Tag**: `phase-7-roadmap`
- **Undo Command**: `git revert f624306`


## Phase 1 Fix 1: Group Session Access Control & Host Key Authentication
- **Status**: Completed & Verified
- **Problem**: Any participant could obtain creatorId and participantIds from public session accessors, allowing unauthorized participants to close group sessions or cast impersonated votes.
- **Fix**:
  - Generated unguessable 256-bit `hostKey` returned once only upon session creation, stored as a SHA-256 hash, verified with `crypto.timingSafeEqual` in `closeGroupSession`.
  - Returned strictly public session views from `getGroupSession` and `joinGroupSession` (omitting `creatorId`, `hostKey`, foreign `participantId`s, and raw voter mappings).
  - Issued per-participant secret on join and enforced `timingSafeEqual` secret verification in `castVote`.
  - Aggregated votes into candidate counts (`voteCounts`) without exposing voter identities.
- **Files**:
  - `server/services/group-mode.js`
  - `server/routes/api.js`
  - `server/tests/phase4-discovery-group.test.js`
- **Verification Result**: Verified with 201/201 passing Vitest tests including 403 authorization checks on rogue session close and impersonated voting attempts.
- **Commit Hash**: `8ea397f`
- **Undo Command**: `git revert 8ea397f`


## Phase 1 Fix 2: Group Session Expiry Enforcement, Input Caps, and Atomic Persistence
- **Status**: Completed & Verified
- **Problem**: Session expiry was checked only on cold start; expired sessions remained accessible for reads, votes, and closing; session store had no IP rate limit or session count ceiling; inputs were unvalidated; file writes were synchronous and non-atomic.
- **Fix**:
  - Enforced expiry check returning HTTP 404 in all accessors (`getGroupSession`, `joinGroupSession`, `castVote`, and `closeGroupSession`) and auto-purging expired entries.
  - Implemented periodic background sweep via `.unref()` timer (`SWEEP_INTERVAL_MS = 5 min`).
  - Added global ceiling (`MAX_TOTAL_SESSIONS = 500`) and per-IP limit (`MAX_SESSIONS_PER_IP = 10`) returning HTTP 429 when exceeded.
  - Validated and capped inputs: `creatorName` (30), `name` (30), `startingArea` (40), `dietaryPreferences` (allowlist of 8 standard tags), and `candidateId` (non-empty string <= 64 chars).
  - Replaced blocking direct file overwrite with atomic temp-file write + rename (`saveSessionsSync`) and debounced saves (`scheduleSave`).
- **Files**:
  - `server/services/group-mode.js`
  - `server/routes/api.js`
  - `server/tests/phase4-discovery-group.test.js`
- **Verification Result**: Verified with 204/204 passing Vitest tests including 404 tests on expired sessions across all 4 accessors, input sanitization tests, and IP rate-limit tests.
- **Commit Hash**: `92b357b`
- **Undo Command**: `git revert 92b357b`
