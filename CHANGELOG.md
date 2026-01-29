# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GOVERNANCE.md defining maintainer roles and decision-making process
- DCO.md (Developer Certificate of Origin) for contribution licensing clarity
- TRADEMARK.md outlining brand usage policy
- SUPPORT.md consolidating community resources and help channels

### Planned
> Features in this section are planned for upcoming releases but not yet implemented.

- SBOM (Software Bill of Materials) generation in CI
- Vulnerability scanning with npm audit
- License compliance checking
- Secrets scanning with Gitleaks
- Test coverage reporting with Codecov
- Docker support (Dockerfile, docker-compose.yml)
- Release automation workflow
- Health check endpoint (`/api/health`)
- Dependabot configuration for automated dependency updates
- CODEOWNERS file for automatic reviewer assignment

### Changed
- Enhanced CI workflow with security scanning jobs
- Updated deployment documentation with rollback and monitoring guidance
- Improved Jest configuration with coverage thresholds
- CONTRIBUTING.md now requires DCO sign-off on commits

### Fixed
- README documentation links now correctly point to `.github/` directory
- Duplicate variable definition in profile page
- Environment validation script now loads `.env.local` correctly

## [0.1.0] - 2026-01-27

### Added
- Initial release
- Next.js 14 with App Router
- Firebase Authentication (Email, Google, GitHub)
- Cloud Firestore database
- Events management
- Talk submissions
- Blog system with Markdown support
- Member directory
- Discord and GitHub OAuth integration
- Dark theme UI with Tailwind CSS
- Mobile-responsive design

[Unreleased]: https://github.com/rogerSuperBuilderAlpha/cursor-boston/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rogerSuperBuilderAlpha/cursor-boston/releases/tag/v0.1.0
