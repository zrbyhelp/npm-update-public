# ZUPublic-node 使用说明

`ZUPublic-node` 是一个可发布到 npm 的命令行工具，用于通过远端接口配置更新本地目录中的静态资源。

包名：

- `zupublic-node`

命令名：

- `zupublic-node`

它的工作流程是：

1. 初始化本地配置和过滤器文件
2. 请求远端接口获取原始数据
3. 通过本地 `TypeScript` 过滤器转换为标准文件列表
4. 仅在单个文件版本发生变化时下载并覆盖本地文件

## 环境要求

- Node.js `24+`
- npm

说明：

- 用户机器不需要单独安装 `TypeScript`
- 过滤器文件虽然是 `.ts`，但当前实现依赖 Node.js 24+ 直接执行

## 安装与构建

如果你在本地开发当前项目：

```bash
npm install
npm run build
```

本地运行：

```bash
node dist/cli.js init
node dist/cli.js pull
```

如果已经发布到 npm：

```bash
npm install -g zupublic-node
zupublic-node init
zupublic-node diff
zupublic-node pull
```

## 命令说明

### `zupublic-node init`

用于初始化配置文件和过滤器文件。

生成文件：

- `update-public.config.json`
- `update-public.filter.ts`

支持参数：

- `-b`, `--baseurl`：直接设置接口地址
- `-t`, `--template`：指定过滤器模板 `id`

示例：

```bash
zupublic-node init -b https://example.com/api/config -t empty
```

如果没有传入 `-b`，命令会交互式提示输入 `baseurl`。

如果没有传入 `-t`，命令会让用户从当前包内置模板中选择。

### `zupublic-node pull`

用于拉取远端配置并同步静态资源。

执行流程：

1. 读取 `update-public.config.json`
2. 请求 `baseurl`
3. 执行本地 `update-public.filter.ts`
4. 得到标准输出 `publics`
5. 按 `type + name` 匹配本地已记录文件
6. 比较单文件 `version`
7. 只下载新增文件或版本变化的文件
8. 保存最新配置并显示进度条

### `zupublic-node diff`

用于查询当前本地记录版本与远端最新版本的差异。

特点：

- 输出新增、版本变更、已删除三类差异
- 不下载文件
- 不修改 `update-public.config.json`
- 支持 `--json` 输出结构化结果

示例：

```bash
zupublic-node diff
zupublic-node diff --json
```

## 配置文件格式

文件名：

```json
update-public.config.json
```

内容格式：

```json
{
  "baseurl": "https://example.com/api/config",
  "auth": {
    "headers": {
      "Authorization": "Bearer ${UPDATE_PUBLIC_TOKEN}"
    }
  },
  "publics": [
    {
      "name": "logo.png",
      "link": "https://example.com/static/logo.png",
      "type": "images",
      "version": "20260403"
    }
  ]
}
```

字段说明：

- `baseurl`：远端接口地址
- `auth.headers`：可选，请求远端接口和下载文件时附带的请求头
- `publics`：上一次同步后的文件清单
- `name`：文件名
- `link`：文件下载地址，可以是绝对地址，也可以是相对地址
- `type`：文件保存目录名，最终会下载到 `./{type}/{name}`
- `version`：单个文件版本号，用于判断是否需要重新下载

认证说明：

- `auth.headers` 会同时用于请求 `baseurl` 和下载资源文件
- 请求头的值支持 `${环境变量名}` 占位，例如 `${UPDATE_PUBLIC_TOKEN}`
- 建议把 token 放到环境变量里，不要直接写死在仓库配置中

示例：

```json
{
  "baseurl": "https://example.com/api/config",
  "auth": {
    "headers": {
      "Authorization": "Bearer ${UPDATE_PUBLIC_TOKEN}",
      "X-App-Id": "demo"
    }
  },
  "publics": []
}
```

## 过滤器文件格式

文件名：

```ts
update-public.filter.ts
```

过滤器必须默认导出一个函数，输入是远端接口原始数据，输出必须是：

```ts
{
  publics: Array<{
    name: string;
    link: string;
    type: string;
    version: string;
  }>;
}
```

空模板示例：

```ts
type RawResponse = unknown;

type FilterOutput = {
  publics: Array<{
    name: string;
    link: string;
    type: string;
    version: string;
  }>;
};

export default function filter(response: RawResponse): FilterOutput {
  void response;

  return {
    publics: [],
  };
}
```

一个更接近真实接口的示例：

```ts
export default function filter(response: any) {
  return {
    publics: response.data.files.map((item: any) => ({
      name: item.fileName,
      link: item.url,
      type: item.category,
      version: item.version,
    })),
  };
}
```

## 文件下载规则

对于过滤器输出中的每一项：

```ts
{
  name: "app.js",
  link: "/assets/app.js",
  type: "scripts",
  version: "v2"
}
```

最终会保存到：

```bash
./scripts/app.js
```

如果目录不存在，会自动创建。

如果文件已存在：

- 当 `version` 未变化时，不下载、不覆盖
- 当 `version` 变化时，下载并覆盖

## 模板维护方式

当前包的过滤器模板由项目维护者在源码中维护，最终用户只能选择，不能直接扩展包内模板。

模板位置：

- `src/templates/`
- `src/templates/index.ts`

新增模板流程：

1. 在 `src/templates/` 新增模板文件
2. 在 `src/templates/index.ts` 中导出并注册模板
3. 发布新的 npm 版本

用户更新 npm 包后，就可以通过：

```bash
zupublic-node init -t 你的模板id
```

来直接选择模板。

## 常见用法

交互初始化：

```bash
zupublic-node init
```

快速初始化：

```bash
zupublic-node init -b https://example.com/api/config -t empty
```

拉取并同步：

```bash
zupublic-node pull
```

## 常见问题

### 1. 用户机器需要安装 TypeScript 吗？

不需要。

### 2. 用户机器必须满足什么条件？

必须安装 Node.js `24+`。

### 3. 为什么过滤器是 `.ts` 还能运行？

当前实现依赖 Node.js 24+ 直接加载本地 `TypeScript` 文件。

### 4. 为什么有些文件没有被更新？

因为当前逻辑按单文件 `version` 判断是否更新。只有新增文件或 `version` 变化的文件才会下载。

### 5. `type` 有什么作用？

`type` 直接作为本地目录名使用，例如 `images`、`scripts`、`css`。
