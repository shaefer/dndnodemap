# Overworld Node Map

A web app for generating, editing, and exporting node-graph overworld maps for tabletop RPGs. See [docs/overworld-map-concept.md](docs/overworld-map-concept.md) for the design vision and [docs/overworld-map-app-spec-v2.md](docs/overworld-map-app-spec-v2.md) for the full technical spec — read `CLAUDE.md` first if you're picking this up in an editor session.

## Prerequisites

- **Node.js 22+** and npm — this project uses [nvm](https://github.com/nvm-sh/nvm). If `node`/`npm` aren't found, make sure `~/.zshrc` sources nvm:
  ```sh
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  ```
- **AWS SAM CLI** — needed for the backend only. Installed via `pip3 install --user aws-sam-cli` on this machine (no Homebrew available); the `sam` binary lands in `~/Library/Python/3.9/bin`, which needs to be on `PATH`.
- **esbuild** — SAM's esbuild build method looks for an `esbuild` binary on `PATH` (not just as a local devDependency). Installed globally via `npm install -g esbuild`.

## Frontend

```sh
cd frontend
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build     # production build
npm test          # vitest run
```

## Backend

```sh
cd backend
npm install
sam build          # bundles the Lambda handler via esbuild
sam local start-api  # runs the API locally (requires Docker)
sam deploy --guided  # first deploy — see docs/overworld-map-app-spec-v2.md Section 14c
```

Through milestone M6, the frontend calls its local `generateMap()` directly and the backend isn't wired in yet. M7 switches the frontend over to call this API instead (see spec Section 16).

## Project Structure

```
frontend/   React + Vite app — deployed to Netlify
backend/    AWS Lambda + API Gateway, deployed via SAM
docs/       Concept doc, technical spec, reference data, prototype
```

See `CLAUDE.md` for the architectural layering rules (core / store / UI) and why the backend exists.
