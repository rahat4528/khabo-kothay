# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-02

### Changed
- Synchronized repository versioning across Expo mobile app (`mobile/app.json`), Node backend (`package.json`), and native wrappers to `1.1.0` (versionCode `4`).
- Streamlined architecture to designated production stack (`/mobile` React Native with Expo and `/server` Node.js Express).

## [4.0.0] - 2026-10-12

### Added
- **Native Android App (Java)**: Material 3, Room database with exported schema, MVVM architecture, LiveData, Retrofit/OkHttp client, bilingual English/Bangla localization with 100% key parity, accessibility TalkBack compliance, and custom Dhaka dining features.
- **Python FastAPI Backend (`/api/v1`)**: Standardized error envelopes, OpenAPI 3.1 contract (`docs/openapi.json`), deterministic clock abstraction locked to `Asia/Dhaka` (`Clock`/`FakeClock`), daily usage guard protecting Google Maps quota, and structured health telemetry.
- **Repository Hygiene & Safety**: Zero-secret verification across repository history, pre-commit hook enforcing secret detection and file-size guardrails, cross-platform `.gitattributes` and `.editorconfig`, and template configurations for `.env`, `local.properties`, and `keystore.properties`.
- **Quality Gates & Automated Verification**: Comprehensive test suites (Python FastAPI, Android core Java units, Node legacy suite), placeholder scanning, link checking, and continuous integration workflows for API, Android, Secrets scanning, and Dependabot.
- **Legacy Support**: Backwards-compatible Node API testing and Expo mobile application resources.
