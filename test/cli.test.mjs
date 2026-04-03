import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const cliPath = path.resolve("dist/cli.js");

test("init creates config and filter files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-init-"));

  try {
    const result = await runCli(["init"], tempDir, { input: "https://example.com/api\n" });
    assert.equal(result.code, 0);

    const config = JSON.parse(await readFile(path.join(tempDir, "update-public.config.json"), "utf8"));
    const filter = await readFile(path.join(tempDir, "update-public.filter.ts"), "utf8");

    assert.deepEqual(config, {
      baseurl: "https://example.com/api",
      publics: [],
    });
    assert.match(filter, /export default function filter/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init supports -b and -t options", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-init-flags-"));

  try {
    const result = await runCli(
      ["init", "-b", "https://example.com/by-flag", "-t", "empty"],
      tempDir,
    );

    assert.equal(result.code, 0, result.stderr);

    const config = JSON.parse(await readFile(path.join(tempDir, "update-public.config.json"), "utf8"));
    const filter = await readFile(path.join(tempDir, "update-public.filter.ts"), "utf8");

    assert.deepEqual(config, {
      baseurl: "https://example.com/by-flag",
      publics: [],
    });
    assert.match(filter, /export default function filter/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("pull updates config and downloads assets", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-pull-"));
  const files = new Map([
    ["/assets/logo.txt", "logo-v2"],
    ["/assets/app.js", "console.log('v2');"],
  ]);
  const downloadCounts = new Map();

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [
              { fileName: "logo.txt", url: "/assets/logo.txt", category: "images", version: "v1" },
              { fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v2" },
            ],
          },
        }),
      );
      return;
    }

    const content = files.get(req.url ?? "");
    if (content) {
      downloadCounts.set(req.url, (downloadCounts.get(req.url) ?? 0) + 1);
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.end(content);
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseurl = `http://127.0.0.1:${address.port}/api/config`;

  try {
    await writeFile(
      path.join(tempDir, "update-public.config.json"),
      `${JSON.stringify(
        {
          baseurl,
          publics: [
            { name: "logo.txt", link: "/assets/logo.txt", type: "images", version: "v1" },
            { name: "app.js", link: "/assets/app.js", type: "scripts", version: "v1" },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await mkdir(path.join(tempDir, "images"), { recursive: true });
    await mkdir(path.join(tempDir, "scripts"), { recursive: true });
    await writeFile(path.join(tempDir, "images", "logo.txt"), "logo-v1", "utf8");
    await writeFile(path.join(tempDir, "scripts", "app.js"), "console.log('v1');", "utf8");

    await writeFile(
      path.join(tempDir, "update-public.filter.ts"),
      `export default function filter(response: any) {
  return {
    publics: response.data.files.map((item: any) => ({
      name: item.fileName,
      link: item.url,
      type: item.category,
      version: item.version,
    })),
  };
}
`,
      "utf8",
    );

    const result = await runCli(["pull"], tempDir);
    assert.equal(result.code, 0, result.stderr);

    const config = JSON.parse(await readFile(path.join(tempDir, "update-public.config.json"), "utf8"));
    const logo = await readFile(path.join(tempDir, "images", "logo.txt"), "utf8");
    const app = await readFile(path.join(tempDir, "scripts", "app.js"), "utf8");

    assert.equal(config.publics.length, 2);
    assert.equal(config.publics[0].version, "v1");
    assert.equal(config.publics[1].version, "v2");
    assert.equal(logo, "logo-v1");
    assert.equal(app, "console.log('v2');");
    assert.equal(downloadCounts.get("/assets/logo.txt") ?? 0, 0);
    assert.equal(downloadCounts.get("/assets/app.js") ?? 0, 1);
    assert.match(result.stdout, /100%/);
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

function runCli(args, workdir, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workdir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
