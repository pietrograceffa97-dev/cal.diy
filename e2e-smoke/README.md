# Production smoke tests

Plain Playwright scripts that check the **live** site. No Claude, no API key —
a machine following written instructions, so a daily run costs nothing.

## Why this is separate from the repo's other e2e tests

The root `playwright.config.ts` builds and boots the app, seeds a database and
needs ~20 secrets. It answers *"does this commit work?"*.

This suite answers a different question — *"is the site working right now?"* —
so it installs one package, needs no secrets, and keeps running even when the
monorepo's build is red. It lives outside the yarn workspaces on purpose.

## Run it locally

```bash
cd e2e-smoke
npm install
npx playwright install chromium   # first time only
npm test
```

Against somewhere else:

```bash
SMOKE_BASE_URL=https://cal-diy-staging.vercel.app npm test
```

## Run it in CI

`.github/workflows/daily-smoke.yml` runs it every morning at 06:00 UTC, and on
demand from the Actions tab (**Run workflow**). Results land in the run's
summary; the trace and screenshots of any failure are attached as an artifact.

To point CI somewhere else, set a repository variable `SMOKE_BASE_URL`.

## Adding a test

One file per journey. Prefer `data-testid` over text — copy changes, ids don't.
Verify your selectors against the live page before committing: a smoke test
that fails for its own reasons is worse than no smoke test at all.
