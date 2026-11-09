# Building git-truck from source

How to build this fork and use it as your everyday `git-truck` command, without Bun. For the dev workflow (dev server, tests, lint), see "Running from source without Bun" in the [README](./README.md#running-from-source-without-bun).

## Prerequisites

- Node.js >= 22
- [pnpm](https://pnpm.io/) (only used to install dependencies)
- Git

## Install dependencies

```sh
pnpm install --config.node-linker=hoisted
echo "pnpm-lock.yaml" >> .git/info/exclude   # once per clone
```

pnpm may end with `ERR_PNPM_IGNORED_BUILDS` for esbuild. The packages are installed and it is safe to ignore.

Do not use `npm install`: npm 10 crashes on this dependency tree (`Cannot read properties of null (reading 'edgesOut')`).

## Build

```sh
node --run build-vite && node --run build-cli
```

This produces `build/` (the web app and server) and `cli.mjs` (the CLI entry point), both gitignored. Do not use `node --run build`: it chains `npm run`, which is not needed and may not work.

Check the result:

```sh
node cli.mjs --version
node cli.mjs               # analyze the repository in the current directory
```

`cli.mjs` loads `build/` and `node_modules/` (for DuckDB) relative to the clone, so run it in place rather than copying it elsewhere.

`build/server/index.js` must end with `export { app }`. If `git-truck` crashes on start with `app.use() requires a middleware function`, the server build used React Router's default entry instead of `src/server/app.ts`. React Router 8 only reads a custom server entry from `environments.ssr.build.rollupOptions.input` in `vite.config.ts`, not from the top-level `build.rollupOptions`.

## Use it as the default `git-truck`

Put a launcher on your PATH that runs the clone's `cli.mjs`, and uninstall any npm-installed `git-truck` so it does not take precedence.

PowerShell (`git-truck.ps1`):

```powershell
& node "C:\path\to\git-truck\cli.mjs" @args
exit $LASTEXITCODE
```

Git Bash / `git truck` (extensionless `git-truck`, made executable):

```sh
#!/bin/sh
exec node "/c/path/to/git-truck/cli.mjs" "$@"
```

Git runs `git truck` by finding a `git-truck` executable on the PATH, so the extensionless script also makes the subcommand form work.

If you manage PATH with mise, add the launcher folder via `[env] _.path = ["C:/path/to/launchers"]`. Git Bash does not run `mise activate` (it only sees mise's shims), so also put a copy or delegate of the sh launcher in `~/bin`, which Git Bash adds to its PATH by default.

## Updating

The launcher runs whatever was last built, so after pulling or merging:

```sh
git checkout main
git pull
pnpm install --config.node-linker=hoisted   # only if dependencies changed
node --run build-vite && node --run build-cli
```

Building on a feature branch replaces your default `git-truck` with that branch until you rebuild `main`. Day-to-day development with `node --run dev:node` does not touch the built files.
