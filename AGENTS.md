# Repository Guidelines

## Project Structure & Module Organization

Source code lives in `src/`, with CLI entry logic in `src/cli.ts` and command handlers under `src/commands/`. Shared helpers such as config loading, downloading, prompts, and templates are kept as focused modules in `src/`. Compiled output is written to `dist/` and is the published runtime for the npm package. Tests live in `test/`, and user-facing Chinese documentation is in `docs/`.

## Build, Test, and Development Commands

- `npm run build`: Compile TypeScript from `src/` into `dist/` using `tsc`.
- `npm test`: Rebuild the package and run the Node test suite in `test/*.test.mjs`.
- `npm pack --dry-run`: Inspect the exact files that will be published to npm.

Run commands from the repository root. When validating CLI behavior locally, build first so `dist/cli.js` is current.

## Coding Style & Naming Conventions

Use TypeScript with strict compiler settings enabled in `tsconfig.json`. Follow the existing style:

- 2-space indentation is preferred in TypeScript files.
- Use double quotes and semicolons consistently.
- Keep modules small and single-purpose.
- Use descriptive file names such as `download.ts`, `progress.ts`, and `commands/pull.ts`.

Export clear function names for shared logic. Keep command-specific behavior inside `src/commands/` rather than mixing it into the CLI entrypoint.

## Testing Guidelines

Tests use Node's built-in `node:test` runner with `assert/strict`. Add new tests in `test/` using the `*.test.mjs` pattern. Prefer behavior-driven names such as `"pull updates config and downloads assets"`. Cover both success paths and file-system side effects for CLI commands.

## Commit & Pull Request Guidelines

Current history uses short, imperative commit messages like `Initial commit` and `Rename package to zupublic-node`. Keep that pattern: one-line summaries that state the change directly. For pull requests, include:

- A short description of the user-visible change
- Notes on build/test results, for example `npm test`
- Package or publishing impact if `package.json`, `dist/`, or templates changed

## Publishing Notes

This package publishes `dist/`, `README.md`, and `docs/`. Before releasing, run `npm test` and `npm pack --dry-run`, then verify the package name/version in `package.json`.
