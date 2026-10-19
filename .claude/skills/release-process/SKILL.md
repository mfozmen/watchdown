---
name: release-process
description: How Watchdown versions and ships releases via release-please — squash-merge rules, the release PR gate, tag/installer build, and the RELEASE_PLEASE_PAT caveat. Use when merging PRs, cutting a release, or touching versioning.
---

# Release process (release-please)

Versioning and releases are automated with **release-please** — do **not** bump `version` in
`package.json` by hand or tag releases manually.

- **Squash-merge PRs** (`gh pr merge <n> --squash --delete-branch`) so each PR lands as a single
  Conventional Commit whose subject is the PR title. Plain merge commits make release-please
  double-count (it reads the branch commit *and* the merge commit's PR title), which duplicated
  every entry in the 1.0.0 changelog — squash avoids that.
- Every merge to `main` runs `.github/workflows/release-please.yml`. From the merged Conventional
  Commits, release-please maintains an open **release PR** (`chore(main): release X.Y.Z`) that
  bumps `package.json` + updates `CHANGELOG.md`. `feat:` → minor, `fix:` → patch, `BREAKING
  CHANGE`/`!` → major — so commit hygiene *is* the version.
- **Cutting a release = merging that release PR** (the human gate). That creates the `vX.Y.Z` tag +
  GitHub Release; the same workflow's build job then packages the Windows/macOS/Linux installers
  and attaches them. No separate tag-triggered workflow (a GITHUB_TOKEN tag wouldn't trigger one).
- With the default `GITHUB_TOKEN`, the release PR release-please opens won't trigger CI/review on
  itself (GitHub suppresses triggers from token-created PRs), so it may need an admin merge under
  branch protection. Add a `RELEASE_PLEASE_PAT` repo secret (contents + pull-requests write) to
  have the normal checks gate the release PR; the workflow falls back to `GITHUB_TOKEN` without it.
  No admin merge needed meanwhile: `gh pr update-branch <n>` on the release PR pushes as you, which
  does trigger CI, Sonar and claude-review, so it merges through the normal gate (done for 1.1.0).
