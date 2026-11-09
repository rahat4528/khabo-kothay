# Git Safety & Inventory Report — Khabo Kothay?
# Date: 2026-10-12
# Phase: Phase 1 — Safety Inventory

---

## 1. Git Repository State

| Parameter | Value | Status |
| :--- | :--- | :---: |
| **Current Branch** | `main` | OK |
| **Upstream Tracking** | `origin/main` (in sync) | OK |
| **Remote Origin URL** | `https://github.com/rahat4528/khabo-kothay.git` | OK |
| **Total Commit Count** | `29` commits | OK |
| **Object Count & Size** | `1,034` objects / `4.48 MiB` | OK |
| **Configured User Name** | `Mahamudul Hasan Rahat` | OK |
| **Configured User Email**| `187889218+rahat4528@users.noreply.github.com` | OK |

---

## 2. Uncommitted Work Summary

### A. Modified Files
* `docs/DECISIONS.md` (Updated with Fix 1 & Polish Architecture Decisions)

### B. Untracked Files Grouped by Directory
* **Root Directory**:
  * `GSD-STYLE.md`, `PROJECT_RULES.md`, `VERSION`, `model_capabilities.yaml`
* **`adapters/`**: Internal adapter modules
* **`android/.gradle/`**: Local Gradle daemon caches (needs ignore rule)
* **`docs/`**:
  * `docs/FIXLOG.md`, `docs/ICON_AUDIT.md`, `docs/POLISH_AUDIT.md`
* **`scripts/`**:
  * `scripts/check_links.py` (URL reachability audit)
  * `scripts/find-placeholders.ps1` & `scripts/find_placeholders.py` (Placeholder scanner)
  * `scripts/image_audit.py` (Asset footprint analyzer)
  * `scripts/secret_scan.py` (Regex secret scanner for tree & history)
  * `scripts/search_repo.*`, `scripts/setup_search.*`, `scripts/validate-*`

---

## 3. Large & Forbidden Files Audit

### A. Files Over 50 MB (All on disk; None tracked in git)
* `app.apk` (61.06 MB) — Untracked / gitignored
* `application-091a2cdf-69dd-4d26-ba02-c92959f1d82e.apk` (64.98 MB) — Untracked / gitignored
* `public/downloads/khabo-kothay-1.1.0.apk` (61.06 MB) — Untracked / gitignored
* `public/downloads/khabo-kothay-latest.apk` (64.98 MB) — Untracked / gitignored
* `release/khabo-kothay-1.1.0.apk` (61.06 MB) — Untracked / gitignored
* `release/khabo-kothay-latest.apk` (64.98 MB) — Untracked / gitignored

### B. Files Between 5 MB and 50 MB
* `mobile/dist/_expo/static/js/android/AppEntry-*.hbc.map` (5.70 MB) — Untracked / gitignored
* `mobile/dist/_expo/static/js/ios/AppEntry-*.hbc.map` (5.67 MB) — Untracked / gitignored

### C. Tracked vs. Untracked Forbidden Patterns
* `.env`: Exists on disk (untracked, properly gitignored)
* `.env.example`: Tracked in git (template with zero secrets)
* `android/local.properties`: **FLAGGED** — Currently tracked in git!
  * *Remediation Plan (Phase 3)*: Run `git rm --cached android/local.properties`, ensure `.gitignore` covers `local.properties`, and supply `android/local.properties.example`.
* Keystores (`*.jks`, `*.keystore`, `*.p12`, `*.pem`): **None tracked in git; none present on disk outside build/node_modules**.

---

## 4. Secret Scan Results (scripts/secret_scan.py)

* **Working Tree Scan**:
  * **0 findings** (Clean). No Google Cloud keys (`AIza...`), private keys, tokens, or credentials.
* **Full Git History Scan (29 commits across all branches)**:
  * **0 findings** (Clean). Zero secrets or credentials committed in historical diffs.
* **Result**: **PASS** — No key rotation or `git filter-repo` rewriting required.
