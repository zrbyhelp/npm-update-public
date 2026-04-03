# ZUPublic-node

`ZUPublic-node` is a publishable npm CLI for syncing local static assets from a remote API.

npm package name:

- `zupublic-node`

CLI command:

- `zupublic-node`

Chinese documentation:

- [docs/README.zh-CN.md](/E:/ZRRK/npm/update_public/docs/README.zh-CN.md)

## 中文快速说明

`ZUPublic-node` 用于根据远端接口和本地过滤器同步静态资源。

核心特点：

- `init` 初始化配置和过滤器模板
- `pull` 拉取远端数据并同步静态文件
- 按单文件 `version` 判断是否需要更新
- 支持 `-b` 和 `-t` 快速初始化

快速开始：

```bash
npm install -g zupublic-node
zupublic-node init -b https://example.com/api/config -t empty
zupublic-node diff
zupublic-node update scripts/app.js styles/theme.css
zupublic-node pull
```

## Commands

### `zupublic-node init`

Creates:

- `update-public.config.json`
- `update-public.filter.ts`

Supports:

- `-b`, `--baseurl` to set `baseurl` directly
- `-t`, `--template` to select a template by template `id`

If `baseurl` is not passed, the CLI asks for it interactively.

The filter file is selected from templates maintained inside this package.

### `zupublic-node pull`

1. Reads `update-public.config.json`
2. Fetches the remote API from `baseurl`
3. Runs `update-public.filter.ts`
4. Compares each remote file by `type + name + version`
5. Only downloads files whose version changed or that are new
6. Shows a progress bar while syncing files
7. Updates local config `publics`

### `zupublic-node diff`

Compares the local recorded `publics` with the latest remote filtered result.

- Shows `ADDED`, `CHANGED`, and `REMOVED` entries
- Does not download files
- Does not rewrite `update-public.config.json`
- Supports `--json` for structured output

Example:

```bash
zupublic-node diff
zupublic-node diff --json
```

### `zupublic-node update`

Downloads only the specified remote assets.

- Accepts one or more `type/name` targets
- Re-downloads the specified files even if the version is unchanged
- Rewrites only the matching entries in `update-public.config.json`
- Fails if any requested target is missing from the latest remote result

Example:

```bash
zupublic-node update scripts/app.js
zupublic-node update scripts/app.js styles/theme.css
```

## Config

```json
{
  "baseurl": "https://example.com/api/config",
  "auth": {
    "headers": {
      "Authorization": "Bearer ${UPDATE_PUBLIC_TOKEN}"
    }
  },
  "publics": []
}
```

`auth.headers` is optional. Header values support `${ENV_NAME}` placeholders, so secrets can stay in environment variables instead of being committed to the config file.

Example:

```bash
# PowerShell
$env:UPDATE_PUBLIC_TOKEN="your-token"
zupublic-node pull
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

After users update to the new package version, they can select that template during `zupublic-node init`.

Example:

```bash
zupublic-node init -b https://example.com/api/config -t empty
```
