# update-public

`update-public` is a publishable npm CLI for syncing local static assets from a remote API.

Chinese documentation:

- [docs/README.zh-CN.md](/E:/ZRRK/npm/update_public/docs/README.zh-CN.md)

## Commands

### `update-public init`

Creates:

- `update-public.config.json`
- `update-public.filter.ts`

Supports:

- `-b`, `--baseurl` to set `baseurl` directly
- `-t`, `--template` to select a template by template `id`

If `baseurl` is not passed, the CLI asks for it interactively.

The filter file is selected from templates maintained inside this package.

### `update-public pull`

1. Reads `update-public.config.json`
2. Fetches the remote API from `baseurl`
3. Runs `update-public.filter.ts`
4. Compares each remote file by `type + name + version`
5. Only downloads files whose version changed or that are new
6. Shows a progress bar while syncing files
7. Updates local config `publics`

## Config

```json
{
  "baseurl": "",
  "publics": []
}
```

## Filter contract

The generated `update-public.filter.ts` must default export a function that returns:

```ts
{
  publics: Array<{ name: string; link: string; type: string; version: string }>;
}
```

## Maintaining templates

Templates are maintained in this package under `src/templates/`.

To add a new selectable template:

1. Add a file in `src/templates/`
2. Export it from `src/templates/index.ts`
3. Publish a new npm version

After users update to the new package version, they can select that template during `update-public init`.

Example:

```bash
update-public init -b https://example.com/api/config -t empty
```
