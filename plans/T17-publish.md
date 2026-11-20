---
id: T17-publish
title: Push to the private remote and prepare GitHub Pages
status: blocked
depends_on: [T16]
owns: [plans/T17-publish.md, .github/**]
reads: [Agents.md, docs/release/**, ../Synthwave_City/.github/workflows/pages.yml]
budget: 0            # packed bytes added to the shipped file
executor: orchestrator
updated: 2026-11-20
---

# T17: Push to the private remote and prepare GitHub Pages

## 1. Purpose

The operator, 2026-11-19: "I've created the private remote at
https://github.com/highsierralabs/Synthwave_City_html. Commit and push the build with a playable
version on the GitHub.io. I will review it before we push it to public."

After this task `main` is on the private remote, and a Pages workflow publishes the committed release
file as `index.html` as soon as Pages can be enabled.

## 2. Context and orientation

- The parent project's workflow (`../Synthwave_City/.github/workflows/pages.yml`) builds with npm and
  deploys only while the repository is public. Its action pins are reused here.
- The product is committed as `docs/release/synthwave-city.html` and must be byte-identical to a
  fresh build (Agents.md, definition of done), so the site serves that file instead of rebuilding.

## 3. Scope

In: the workflow, the remote, the push, the records. Out: making the repository public, the account
plan, a custom domain.

## 4. Interfaces

The site, when live: `https://highsierralabs.github.io/Synthwave_City_html/` (the UTF-16 file) and
`.../safe.html` (the ASCII twin).

## 5. Plan of work

M1. Scan the history for home paths, host names, tailnet addresses and secrets. M2. Try to enable
Pages. M3. Workflow, records, commit, remote, push. M4. Watch the workflow run.

## 6. Validation and acceptance

- The scan finds nothing private. `git ls-remote origin main` equals local `HEAD`. The workflow's
  build job succeeds; its deploy job is skipped while the repository is private.

## 7. Idempotence and recovery

Pushing again is harmless. Enabling Pages later: `gh api -X POST
repos/highsierralabs/Synthwave_City_html/pages -f build_type=workflow`, then re-run the workflow.

## 8. Progress

- [x] 2026-11-19 M1. 37 commits, all authored by the noreply address, no AI trailers. No match in
  any commit for the user's home folder, `Users/`, the desktop's host name, the tailnet name, `ts.net`,
  100.x or 192.168 addresses, GitHub or Anthropic token prefixes, `password`, `api key`, private
  keys or e-mail addresses. Present and not private, but worth a look before going public: workspace
  paths `C:\highsierralabs\...` in Agents.md, `tools/pack/browser-test.mjs` and plans T00, T01, T04 to
  T07, T09, T13 and T15 (they point at the parent project on this machine).
- [x] 2026-11-19 M2. Blocked: `POST /repos/.../pages` answered 422, "Your current plan does not
  support GitHub Pages for this repository."
- [x] 2026-11-19 M3. Workflow and records committed (`d6f6d59`); `origin` added; `git push -u origin
  main`; `git ls-remote origin main` = local HEAD `d6f6d59`.
- [x] 2026-11-19 M4. Run 44686037113: build job success in 6 s, deploy job skipped (private). The
  downloaded `github-pages` artifact holds `index.html` and `safe.html` byte-identical to
  `docs/release/synthwave-city.html` and `.safe.html`, and `LICENSE`.
- [x] 2026-11-20 Review copy, the operator's choice: a tailnet-only preview. A scratch Node server
  outside the repository binds `127.0.0.1:5182` and serves `docs/release/` (`/` the UTF-16 file,
  `/safe.html` the ASCII twin, `text/html`, `no-store`, read on every request); `tailscale serve
  --bg --http 5182` maps the tailnet to it, no funnel. Over the tailnet address both pages came back
  200 `text/html` and byte-identical to the release files, and both booted in Chromium on the GPU
  with a canvas and no console or shader errors. Not checked: the operator's phone or tablet. The
  mapping persists; the server lives only as long as the session that started it. Remove with
  `tailscale serve --http=5182 off`.

## 9. Surprises and discoveries

- GitHub Pages is not available for a private repository on this account's plan. Where it is (a paid
  plan), the site is still public to anyone with the address; only GitHub Enterprise Cloud can
  restrict a Pages site to signed-in users. A private preview on github.io is not possible here.

## 10. Decision log

- 2026-11-19. **Serve the committed file, do not rebuild in CI.** The reviewed file is the published
  file, and the workflow needs no Node, npm or Chromium.
- 2026-11-19. **Deploy only while public**, as in the parent: until then every push would fail the
  deploy job.
- 2026-11-19. **Nothing made public, no plan changed.** Both are the operator's decisions.

## 11. Contract change requests

None.

## 12. Outcomes and retrospective

The review copy is served on the tailnet (Progress, 2026-11-20). Open until the operator reviews it
and decides on making the repository public.
