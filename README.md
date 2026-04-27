# NxMixed

An [Nx](https://nx.dev) workspace that mixes **Angular** and **.NET** projects under one task graph. Use Nx for orchestration, caching, and `affected` detection across both stacks.

## Layout

```text
apps/
  demo-app/                  # Angular 21 (port 4200)
  demo-dotnet-api/           # ASP.NET minimal API (port 5039) → references Demo.Domain
libs/
  web/
    shared-ui/               # Angular lib, imported via @nx-mixed/shared-ui
  dotnet/
    Demo.Domain/             # .NET classlib, holds shared records (e.g. WeatherForecast)
```

Existing edges (verify with `npx nx graph`):

- `demo-app` → `shared-ui` (TypeScript import via the `@nx-mixed/shared-ui` path alias)
- `demo-dotnet-api` → `Demo.Domain` (MSBuild `<ProjectReference>`)

The two stacks **cannot import each other directly**. The boundary is HTTP (see [Cross‑stack](#cross-stack-angular-↔-net)).

## Daily commands

```sh
# run both apps together (script defined in package.json)
npm run demo

# individual apps
npx nx serve demo-app                       # Angular (continuous)
npx nx run demo-dotnet-api:watch            # .NET hot reload (continuous)
npx nx run demo-dotnet-api:run              # .NET one-shot

# anything Nx can do for a project
npx nx show project <name>                  # list inferred + configured targets
npx nx graph                                # visual graph of both stacks
npx nx affected -t build test lint          # only what changed (and dependents)
npx nx run-many -t build                    # everything, in parallel
```

`@nx/dotnet` infers `build`, `restore`, `clean`, `publish`, `pack`, `watch`, `run`, `test` from each `*.csproj` — no `project.json` needed for .NET projects unless you want to override something (e.g. mark `run` as continuous).

## Demo app

`apps/demo-app` renders a small weather table at `http://localhost:4200/` populated by `GET /api/weatherforecast` against `apps/demo-dotnet-api`. End‑to‑end smoke test for the mixed setup. Above the table, a `<ui-shared-ui>` banner is rendered from `@nx-mixed/shared-ui` to demonstrate consumption of the Angular lib.

The Angular dev server proxies `/api/*` → `http://localhost:5039` via `apps/demo-app/proxy.conf.json` (wired into the `serve` target via `options.proxyConfig`). This avoids CORS in dev; in prod, swap `/api` for an env‑driven base URL.

`WeatherForecast` lives in `libs/dotnet/Demo.Domain` — moving it out of `Program.cs` proves the .NET `<ProjectReference>` chain is honored by `nx build` (which runs `Demo.Domain:build` before `demo-dotnet-api:build` via the inferred `^build` dependency).

## Adding an Angular library

The generator takes the **directory** as the positional argument and the project name via `--name`. It does not support `--dry-run`.

```sh
npx nx g @nx/angular:library libs/web/<name> \
  --name=<name> \
  --tags=scope:web,type:ui \
  --prefix=ui \
  --no-interactive
```

Concrete example used in this repo:

```sh
npx nx g @nx/angular:library libs/web/shared-ui \
  --name=shared-ui --tags=scope:web,type:ui --prefix=ui --no-interactive
```

What the generator does:

- Creates `libs/web/<name>/` with a `project.json`, sample standalone component, lint and test targets.
- Adds a path alias to `tsconfig.base.json`: `"@nx-mixed/<name>": ["libs/web/<name>/src/index.ts"]`.
- No further wiring needed — apps and other libs can `import { ... } from '@nx-mixed/<name>'` immediately. Nx infers the dependency from the import.

Defaults to **non‑buildable** (consumer's bundler compiles the source). Pass `--buildable` for an own `ng-packagr` build target, or `--publishable --import-path=@your-org/<name>` for npm publishing. Default to non‑buildable unless you have a reason.

## Adding a .NET library

`@nx/dotnet` has no library generator — use the `dotnet` CLI directly. The plugin auto‑detects on the next `nx` invocation. Pass full `.csproj` paths to `dotnet add reference` (the shorthand expects the directory to contain a single `.csproj`, which is fine but explicit paths are clearer).

```sh
# class library
dotnet new classlib -o libs/dotnet/<Name> -f net10.0

# test project (auto-recognized as a test project — gets a `test` target)
dotnet new xunit -o libs/dotnet/<Name>.Tests -f net10.0

# wire references (these build the Nx graph via <ProjectReference>)
dotnet add libs/dotnet/<Name>.Tests/<Name>.Tests.csproj reference libs/dotnet/<Name>/<Name>.csproj
dotnet add apps/demo-dotnet-api/demo-dotnet-api.csproj reference libs/dotnet/<Name>/<Name>.csproj
```

Concrete example used in this repo (the API depends on `Demo.Domain` for the `WeatherForecast` record):

```sh
dotnet new classlib -o libs/dotnet/Demo.Domain -f net10.0
dotnet add apps/demo-dotnet-api/demo-dotnet-api.csproj reference libs/dotnet/Demo.Domain/Demo.Domain.csproj
```

Verify: `npx nx graph` shows the new edges, and `npx nx build demo-dotnet-api` automatically runs `Demo.Domain:build` first via the inferred `^build` dependency.

Optional but recommended:

- Add a root `.sln` (`dotnet new sln && dotnet sln add **/*.csproj`) so IDEs and `dotnet build NxMixed.sln` work without thinking. Nx itself doesn't need it.
- Add a root `Directory.Packages.props` with `<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>` to pin NuGet versions across the repo.
- Drop a tiny `project.json` next to a `.csproj` only when you need to add tags or override an inferred target — it merges with the inferred config.

## Cross‑stack (Angular ↔ .NET)

You cannot share code between TypeScript and C#. Three options, increasing in robustness:

1. **Hand‑mirrored DTOs** — what the demo app does today (an interface in TS that matches the C# record). Fine for a few endpoints; drifts.
2. **OpenAPI codegen** — `Program.cs` already calls `AddOpenApi()`. Generate a typed TS client (e.g. `openapi-typescript`) into a `libs/web/api-client` lib whose `generate` target `dependsOn: ["demo-dotnet-api:build"]`. Apps then import from `@nx-mixed/api-client`.
3. **Shared OpenAPI doc in git** — variant of (2) with the spec checked in; simpler graph, slower drift detection.

## Module boundaries

The `@nx/eslint` plugin is already set up. As soon as you have ≥2 libs, add an `enforce-module-boundaries` rule to the root ESLint config and tag every project. Suggested taxonomy:

```jsonc
"tags": ["scope:web",    "type:ui"]            // libs/web/shared-ui
"tags": ["scope:web",    "type:data-access"]   // libs/web/api-client
"tags": ["scope:dotnet", "type:domain"]        // libs/dotnet/Demo.Domain
"tags": ["scope:app"]                          // apps/*
```

The .NET side is naturally isolated (no import path crosses the runtime boundary), but tagging keeps `nx graph` readable and lets you write rules like _"`scope:web` cannot depend on `scope:dotnet`"_ for symmetry.

## Generators & plugins

```sh
npx nx list                  # installed plugins
npx nx list @nx/angular      # generators + executors for a plugin
npx nx add <plugin>          # install a new plugin
```

Available out of the box: `@nx/angular`, `@nx/dotnet`, `@nx/eslint`, `@nx/playwright`, `@nx/js`, `@nx/web`, `@nx/workspace`.

## CI

A tailored GitHub Actions workflow lives at `.github/workflows/ci.yml`. It runs on push to `main` and on every PR, and:

- sets up **Node 24** and the **.NET 10 SDK** (the workflow has to cover both stacks since the standard `nx g ci-workflow` only knows about Node),
- caches `~/.nuget/packages` and `~/.cache/ms-playwright` alongside the built‑in `npm` cache,
- runs `npx nx affected -t lint test build e2e-ci` — Nx skips projects that don't define a given target, so this single command covers Angular lint/test/build, .NET build (incl. the `^build` chain through `Demo.Domain`), and Playwright e2e,
- uses [`nrwl/nx-set-shas`](https://github.com/marketplace/actions/nx-set-shas) to derive `NX_BASE`/`NX_HEAD` so `affected` works on push commits too.

### Hooking it up to Nx Cloud

```sh
# 1. Connect the workspace (interactive — opens a browser to claim the workspace)
npx nx connect

# 2. Commit the resulting `nxCloudId` in nx.json and push
git add nx.json && git commit -m "chore: connect to Nx Cloud" && git push
```

Once connected you get **remote cache** out of the box (free tier). To also enable **distributed task execution** (paid / trial), uncomment the `npx nx start-ci-run …` line near the top of `.github/workflows/ci.yml`.

`npx nx fix-ci` at the end of the workflow is a no‑op until the workspace is connected; once it is, failed tasks get [self‑healing CI](https://nx.dev/ci/features/self-healing-ci) suggestions on the PR.

## Useful links

- [Nx .NET plugin docs](https://nx.dev/docs/technologies/dotnet/introduction)
- [Nx Angular plugin docs](https://nx.dev/technologies/angular)
- [Run tasks](https://nx.dev/features/run-tasks) · [Inferred tasks](https://nx.dev/concepts/inferred-tasks) · [Module boundaries](https://nx.dev/features/enforce-module-boundaries)
- [Nx Console (VSCode / JetBrains)](https://nx.dev/getting-started/editor-setup)
- Community: [Discord](https://go.nx.dev/community) · [Blog](https://nx.dev/blog) · [YouTube](https://www.youtube.com/@nxdevtools)

## Gotchas

A running list of non-obvious things that have bitten us. Add to it when you hit a new one.

### `@nx/dotnet` `build` doesn't restore by default

The plugin infers the `build` target as `dotnet build --no-restore --no-dependencies` and does **not** make it `dependsOn: ["restore"]`. On a fresh clone (or in CI) you'll get:

```text
error NETSDK1004: Assets file '.../obj/project.assets.json' not found.
Run a NuGet package restore to generate this file.
```

Fixed in this repo by configuring the plugin in `nx.json`:

```jsonc
{
  "plugin": "@nx/dotnet",
  "options": {
    "build": { "dependsOn": ["restore", "^build"] },
  },
}
```

The plugin's options API only merges the canonical target names (`build`, `test`, `restore`, `clean`, `publish`, `pack`, `watch`, `run`). Variants like `build:release` are silently ignored if you put them in `options` — so `nx pack` (which depends on `build:release`) would still fail on a fresh clone. We don't run `pack` in CI today; if you wire it in, run `nx run-many -t restore` first or pre-build.

### `nx affected -t … e2e` starts a dev server

Playwright's `webServer` config boots `nx run demo-app:serve:development` as a continuous dependency of `demo-app-e2e:e2e`. You'll see a `serve` line and "Watch mode enabled" in the affected output — that's expected, it shuts down when the e2e run finishes (exit 130 in the CI logs).

### The two stacks can't import each other

There's no shared-code path between TypeScript and C# — the boundary is HTTP. See [Cross-stack](#cross-stack-angular-↔-net) for the three ways to keep DTOs in sync.

### `@nx/angular:library` generator quirks

- The directory is the **positional argument**, the project name is `--name`. Mixing them up generates the lib in the wrong place.
- It does not support `--dry-run`.
- Defaults to non-buildable. Pass `--buildable` only when you need an `ng-packagr` build target.
