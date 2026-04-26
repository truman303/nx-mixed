# NxMixed

An [Nx](https://nx.dev) workspace that mixes **Angular** and **.NET** projects under one task graph. Use Nx for orchestration, caching, and `affected` detection across both stacks.

## Layout

```text
apps/
  demo-app/                 # Angular 21 (port 4200)
  demo-dotnet-api/          # ASP.NET minimal API (port 5039)
libs/
  web/<name>/               # Angular libraries (path-aliased)
  dotnet/<Name>/             # .NET class libraries (ProjectReference-linked)
```

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

`apps/demo-app` renders a small weather table at `http://localhost:4200/` populated by `GET /api/weatherforecast` against `apps/demo-dotnet-api`. End‑to‑end smoke test for the mixed setup.

The Angular dev server proxies `/api/*` → `http://localhost:5039` via `apps/demo-app/proxy.conf.json` (wired into the `serve` target via `options.proxyConfig`). This avoids CORS in dev; in prod, swap `/api` for an env‑driven base URL.

## Adding an Angular library

```sh
npx nx g @nx/angular:library shared-ui \
  --directory=libs/web/shared-ui \
  --tags=scope:web,type:ui \
  --no-interactive --dry-run     # drop --dry-run when output looks right
```

What the generator does:

- Creates `libs/web/shared-ui/` with a `project.json`, sample standalone component, lint and test targets.
- Adds a path alias to `tsconfig.base.json`: `"@nx-mixed/shared-ui": ["libs/web/shared-ui/src/index.ts"]`.
- No further wiring needed — apps and other libs can `import { ... } from '@nx-mixed/shared-ui'` immediately. Nx infers the dependency from the import.

Defaults to **non‑buildable** (consumer's bundler compiles the source). Pass `--buildable` for an own `ng-packagr` build target, or `--publishable --import-path=@your-org/shared-ui` for npm publishing. Default to non‑buildable unless you have a reason.

## Adding a .NET library

`@nx/dotnet` has no library generator — use the `dotnet` CLI directly. The plugin auto‑detects on the next `nx` invocation.

```sh
# class library
dotnet new classlib -o libs/dotnet/Demo.Domain -f net10.0

# test project (auto-recognized as a test project — gets a `test` target)
dotnet new xunit -o libs/dotnet/Demo.Domain.Tests -f net10.0
```

Wire references with the `dotnet` CLI — `@nx/dotnet` reads `<ProjectReference>` to build the graph:

```sh
# tests depend on the lib
dotnet add libs/dotnet/Demo.Domain.Tests reference libs/dotnet/Demo.Domain

# api depends on the lib
dotnet add apps/demo-dotnet-api reference libs/dotnet/Demo.Domain
```

Verify it landed: `npx nx graph` should now show edges into `Demo.Domain`.

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

The .NET side is naturally isolated (no import path crosses the runtime boundary), but tagging keeps `nx graph` readable and lets you write rules like *"`scope:web` cannot depend on `scope:dotnet`"* for symmetry.

## Generators & plugins

```sh
npx nx list                  # installed plugins
npx nx list @nx/angular      # generators + executors for a plugin
npx nx add <plugin>          # install a new plugin
```

Available out of the box: `@nx/angular`, `@nx/dotnet`, `@nx/eslint`, `@nx/playwright`, `@nx/js`, `@nx/web`, `@nx/workspace`.

## CI

```sh
npx nx connect            # optional: Nx Cloud (remote cache, distribution, flaky detection)
npx nx g ci-workflow      # generate a CI workflow for your provider
```

Use `npx nx affected -t build test lint` in CI to only run what changed.

## Useful links

- [Nx .NET plugin docs](https://nx.dev/docs/technologies/dotnet/introduction)
- [Nx Angular plugin docs](https://nx.dev/technologies/angular)
- [Run tasks](https://nx.dev/features/run-tasks) · [Inferred tasks](https://nx.dev/concepts/inferred-tasks) · [Module boundaries](https://nx.dev/features/enforce-module-boundaries)
- [Nx Console (VSCode / JetBrains)](https://nx.dev/getting-started/editor-setup)
- Community: [Discord](https://go.nx.dev/community) · [Blog](https://nx.dev/blog) · [YouTube](https://www.youtube.com/@nxdevtools)
