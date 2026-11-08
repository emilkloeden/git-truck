# Git Truck 🚛

[![Git Truck on NPMX](https://img.shields.io/npm/v/git-truck)](https://www.npmx.dev/git-truck)

Git Truck is a local, interactive visualization workspace for Git repositories, built for inspecting a codebase through structure, commit activity, authorship, and history.

- Browse and zoom into the repository structure
- See _who_ worked _where_, _when_ and _what_ they worked on
- Spot active areas of the codebase
- Explore how the codebase changed over time

Git Truck can assist you in quickly answering questions like:

| _How is the repository structured?_                                                       | _Where has the project been active recently?_                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ![Example of file type visualization](./docs/examples/npmx%20-%20file%20type.png)         | ![Example of most changed files recently](./docs/examples/npmx%20-%20commits%20-%20last%20changed.png) |
| _**Who has changed the most lines per file?**_                                            | _**Where and when have specific contributors worked?**_                                                |
| ![Inspecting specific contributor activity](./docs/examples/npmx%20-%20top%20churner.png) | ![Example of the contributors metric](./docs/examples/npmx%20-%20specific%20contributors.png)          |

## Why Git Truck?

- Runs locally: no tracking, cloud storage, remote servers, ads, or subscription
- Works offline
- Works with any Git repository

## Install

Requires [Node.js](https://nodejs.org/en/) and [Git](https://git-scm.com/downloads).

```sh
npm install -g git-truck@latest
```

## Usage

Open a repository:

```sh
cd path/to/repository
git truck
```

Or pass a path directly:

```sh
git truck path/to/repository
git truck path/to/folder-with-repositories
```

When the path contains multiple repositories, Git Truck opens a repository browser. Otherwise, it opens the visualization in your default browser.

Run `git truck --help` for advanced options.

## Troubleshooting

- If the browser does not open automatically, copy or click the URL from the terminal.
- Large repositories can take a little while to analyze the first time and may feel slow to navigate and interact with.

## Running from source without Bun

[CONTRIBUTING.md](./CONTRIBUTING.md) assumes [Bun](https://bun.sh/). If Bun is not available, Node.js (>= 22) plus [pnpm](https://pnpm.io/) works:

```sh
# Install dependencies. The hoisted linker gives a flat node_modules like bun install does.
pnpm install --config.node-linker=hoisted

# Keep pnpm's lockfile out of git without touching .gitignore
echo "pnpm-lock.yaml" >> .git/info/exclude
```

pnpm may finish with `ERR_PNPM_IGNORED_BUILDS` for esbuild. The packages are still installed and the warning is safe to ignore.

Run scripts with `node --run`, which puts `node_modules/.bin` on the PATH without needing npm or bun:

| Task          | Command                                         |
| :------------ | :---------------------------------------------- |
| Dev server    | `node --run dev:node`                           |
| Unit tests    | `node --run test:unit`                          |
| Typecheck     | `node --run typecheck`                          |
| Lint / format | `node --run lint` / `node --run format:check`   |
| Build         | `node --run build-vite && node --run build-cli` |
| Run built CLI | `node cli.mjs`                                  |

Notes:

- The dev server runs headless and prints the URL to open. If port 3000 is taken (e.g. by an installed `git-truck`), it picks the next free port.
- Avoid `bun ...` scripts (`dev`, `dev:bun`, `update-deps`, `changeset`, `release`) and scripts that chain `npm run` (`build`, `test`, `check`, `check:write`); use the individual scripts above instead.
- `pnpm exec` and `npx` are not needed. `pnpm exec` re-checks the install and fails on the ignored esbuild build script.
- `npm install` is not an alternative: npm 10 crashes on this dependency tree (`Cannot read properties of null (reading 'edgesOut')`).

## Learn more

- [Feature overview](https://git-truck.github.io/git-truck/docs)
- [Research papers](https://github.com/git-truck/papers/blob/master/README.md)
- [Issue tracker](https://github.com/git-truck/git-truck/issues)
