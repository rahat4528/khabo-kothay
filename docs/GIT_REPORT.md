# Git Report — Khabo Kothay? (খাবো কোথায়?)
# Date: 2026-10-12
# Gate Status: Production Ready / Release Gate

---

## 1. Remote & Repository Metadata
- **Repository Remote URL**: `https://github.com/rahat4528/khabo-kothay`
- **Remote Host**: GitHub
- **Active Branch**: `main` (Default branch)
- **Repository Tracking**: `origin/main`
- **Total Commit Count**: 29 base commits (+ hygiene & release-gate commits)
- **Packed Repository Size**: ~5.33 MiB (clean, no large files)
- **Max Tracked File Size**: < 2.0 MiB (No file exceeds 50 MB threshold)

---

## 2. Release & Safety Tags
| Tag Name | Purpose / Milestone | Target Commit |
| :--- | :--- | :--- |
| `pre-push-20261012` | Pre-reorganization safety checkpoint | `bb8c2c8` |
| `phase-0` | Initial environment & Section 8 fix checkpoint | `f5e972c` |
| `phase-F` | Shared foundation & OpenAPI contract | `ab2af76` |
| `day1-stage6` | Early prototype baseline | Historic |
| `v4.0.0` | Production release matching Android v4.0.0 & FastAPI v4.0.0 | Release Gate |

---

## 3. Ignored Files & Hygiene Enforcement
The repository strictly ignores the following patterns via `.gitignore`:
- **Secrets & Credentials**: `.env`, `.env.*`, `*.env` (except `.env.example`), `local.properties`, `keystore.properties`, `*.jks`, `*.keystore`, `*.pem`, `*.p12`, `google-services.json`.
- **Binaries & Package Builds**: `*.apk`, `*.aab`, `/release/`, `build/`, `android/app/build/`, `.gradle/`.
- **Runtime & Cache**: `node_modules/`, `__pycache__/`, `.venv/`, `venv/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `coverage/`, `.coverage`.
- **IDE Artifacts**: `.idea/`, `*.iml`, `captures/`, `.cxx/`, `.externalNativeBuild/`.

### Verified Cached Removal
- `android/local.properties` untracked via `git rm --cached` (local file preserved on developer workstation).
- `LICENSE` untracked pending explicit license selection (default copyright applies per `docs/DECISIONS.md`).

---

## 4. Local Pre-Commit Hook Configuration
- **Location**: `.githooks/pre-commit`
- **Enabled via**: `git config core.hooksPath .githooks`
- **Verification Gates**:
  1. Executes `python scripts/secret_scan.py --staged` on every commit attempt.
  2. Blocks commit if any forbidden pattern (`.env`, `local.properties`, `*.jks`, `*.apk`, etc.) is staged.
  3. Rejects any staged file exceeding 5 MB in size.

---

## 5. Undo & Rollback Procedures
### How to revert a specific commit cleanly:
```powershell
# Revert the latest commit without rewriting public history:
git revert HEAD

# Revert a specific commit SHA:
git revert <commit-sha>
```

### How to recover state from the pre-push safety tag:
```powershell
# Inspect the exact state before hygiene changes:
git checkout pre-push-20261012

# Or create a recovery branch:
git checkout -b recovery/pre-push pre-push-20261012
```

---

## 6. Continuous Integration (GitHub Actions)
1. **API CI (`.github/workflows/api.yml`)**: Python 3.11, Ruff lint & format check, Mypy typing, Pytest with coverage, OpenAPI contract verification, and Pip-Audit security scan.
2. **Android CI (`.github/workflows/android.yml`)**: Java 17, Gradle cache, dummy `local.properties` generation, unit tests, and debug APK assembly with report artifact upload.
3. **Secret Scan (`.github/workflows/secrets-scan.yml`)**: In-repo secret detection and credential protection.
4. **Dependabot (`.github/dependabot.yml`)**: Automated weekly dependency checks for pip, gradle, npm, and github-actions.
