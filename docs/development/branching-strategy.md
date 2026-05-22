# Branching Strategy

CaterSync AI uses a lightweight Git Flow model:

- `main` contains production-ready code.
- `develop` collects completed work for the next release.
- `feature/<short-name>` is used for focused implementation work.
- `fix/<short-name>` is used for defects.
- `release/<version>` is used for final hardening.

Pull requests should target `develop` unless they are urgent production fixes. Keep branches short-lived and prefer small, reviewable changes.
