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

test("pull sends configured auth headers for api and asset requests", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-auth-"));
  const expectedAuth = "Bearer secret-token";
  const seenAuthHeaders = [];

  const server = http.createServer((req, res) => {
    seenAuthHeaders.push(req.headers.authorization ?? "");

    if (req.headers.authorization !== expectedAuth) {
      res.writeHead(401);
      res.end("unauthorized");
      return;
    }

    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [
              { fileName: "secure.js", url: "/assets/secure.js", category: "scripts", version: "v1" },
            ],
          },
        }),
      );
      return;
    }

    if (req.url === "/assets/secure.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end("console.log('secure');");
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
          auth: {
            headers: {
              Authorization: "Bearer ${UPDATE_PUBLIC_TOKEN}",
            },
          },
          publics: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

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

    const result = await runCli(["pull"], tempDir, {
      env: {
        UPDATE_PUBLIC_TOKEN: "secret-token",
      },
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await readFile(path.join(tempDir, "scripts", "secure.js"), "utf8"), "console.log('secure');");
    assert.deepEqual(seenAuthHeaders, [expectedAuth, expectedAuth]);
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("diff prints added changed and removed assets", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-diff-"));

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [
              { fileName: "logo.txt", url: "/assets/logo.txt", category: "images", version: "v2" },
              { fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v1" },
            ],
          },
        }),
      );
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
            { name: "legacy.js", link: "/assets/legacy.js", type: "scripts", version: "v9" },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

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

    const result = await runCli(["diff"], tempDir);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /ADDED scripts\/app\.js version: v1/);
    assert.match(result.stdout, /CHANGED images\/logo\.txt version: v1 -> v2/);
    assert.match(result.stdout, /REMOVED scripts\/legacy\.js version: v9/);

    const config = JSON.parse(await readFile(path.join(tempDir, "update-public.config.json"), "utf8"));
    assert.equal(config.publics.length, 2);
    assert.equal(config.publics[0].version, "v1");
    assert.equal(config.publics[1].version, "v9");
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("diff supports json output", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-diff-json-"));

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [{ fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v2" }],
          },
        }),
      );
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
          publics: [{ name: "app.js", link: "/assets/app.js", type: "scripts", version: "v1" }],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

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

    const result = await runCli(["diff", "--json"], tempDir);
    assert.equal(result.code, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.added, []);
    assert.deepEqual(output.removed, []);
    assert.deepEqual(output.changed, [
      {
        name: "app.js",
        type: "scripts",
        link: "/assets/app.js",
        previousVersion: "v1",
        nextVersion: "v2",
      },
    ]);
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("diff prints no differences message when versions match", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-diff-same-"));

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [{ fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v1" }],
          },
        }),
      );
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
          publics: [{ name: "app.js", link: "/assets/app.js", type: "scripts", version: "v1" }],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

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

    const result = await runCli(["diff"], tempDir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /No differences found\./);
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("update downloads a single specified asset and refreshes only that config entry", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-update-one-"));
  const downloadCounts = new Map();

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [
              { fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v2" },
              { fileName: "logo.txt", url: "/assets/logo.txt", category: "images", version: "v5" },
            ],
          },
        }),
      );
      return;
    }

    if (req.url === "/assets/app.js") {
      downloadCounts.set(req.url, (downloadCounts.get(req.url) ?? 0) + 1);
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end("console.log('v2');");
      return;
    }

    if (req.url === "/assets/logo.txt") {
      downloadCounts.set(req.url, (downloadCounts.get(req.url) ?? 0) + 1);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("logo-v5");
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
            { name: "app.js", link: "/assets/app.js", type: "scripts", version: "v1" },
            { name: "logo.txt", link: "/assets/logo.txt", type: "images", version: "v1" },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await mkdir(path.join(tempDir, "scripts"), { recursive: true });
    await mkdir(path.join(tempDir, "images"), { recursive: true });
    await writeFile(path.join(tempDir, "scripts", "app.js"), "console.log('old');", "utf8");
    await writeFile(path.join(tempDir, "images", "logo.txt"), "logo-old", "utf8");

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

    const result = await runCli(["update", "scripts/app.js"], tempDir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /UPDATED scripts\/app\.js version: v2/);
    assert.equal(downloadCounts.get("/assets/app.js") ?? 0, 1);
    assert.equal(downloadCounts.get("/assets/logo.txt") ?? 0, 0);
    assert.equal(await readFile(path.join(tempDir, "scripts", "app.js"), "utf8"), "console.log('v2');");
    assert.equal(await readFile(path.join(tempDir, "images", "logo.txt"), "utf8"), "logo-old");

    const config = JSON.parse(await readFile(path.join(tempDir, "update-public.config.json"), "utf8"));
    assert.deepEqual(config.publics, [
      { name: "app.js", link: "/assets/app.js", type: "scripts", version: "v2" },
      { name: "logo.txt", link: "/assets/logo.txt", type: "images", version: "v1" },
    ]);
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("update downloads multiple specified assets and adds missing local entries to config", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-update-many-"));

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [
              { fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v3" },
              { fileName: "theme.css", url: "/assets/theme.css", category: "styles", version: "v7" },
            ],
          },
        }),
      );
      return;
    }

    if (req.url === "/assets/app.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end("console.log('v3');");
      return;
    }

    if (req.url === "/assets/theme.css") {
      res.writeHead(200, { "Content-Type": "text/css" });
      res.end("body { color: red; }");
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
          publics: [{ name: "app.js", link: "/assets/app.js", type: "scripts", version: "v1" }],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

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

    const result = await runCli(["update", "scripts/app.js", "styles/theme.css"], tempDir);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /UPDATED scripts\/app\.js version: v3/);
    assert.match(result.stdout, /UPDATED styles\/theme\.css version: v7/);
    assert.equal(await readFile(path.join(tempDir, "scripts", "app.js"), "utf8"), "console.log('v3');");
    assert.equal(await readFile(path.join(tempDir, "styles", "theme.css"), "utf8"), "body { color: red; }");

    const config = JSON.parse(await readFile(path.join(tempDir, "update-public.config.json"), "utf8"));
    assert.deepEqual(config.publics, [
      { name: "app.js", link: "/assets/app.js", type: "scripts", version: "v3" },
      { name: "theme.css", link: "/assets/theme.css", type: "styles", version: "v7" },
    ]);
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("update forces re-download even when version is unchanged", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-update-force-"));
  let downloadCount = 0;

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [{ fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v1" }],
          },
        }),
      );
      return;
    }

    if (req.url === "/assets/app.js") {
      downloadCount += 1;
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end("console.log('fresh');");
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
          publics: [{ name: "app.js", link: "/assets/app.js", type: "scripts", version: "v1" }],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await mkdir(path.join(tempDir, "scripts"), { recursive: true });
    await writeFile(path.join(tempDir, "scripts", "app.js"), "console.log('stale');", "utf8");

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

    const result = await runCli(["update", "scripts/app.js"], tempDir);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(downloadCount, 1);
    assert.equal(await readFile(path.join(tempDir, "scripts", "app.js"), "utf8"), "console.log('fresh');");
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("update fails before downloading when target is missing remotely", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-update-missing-"));
  let downloadCount = 0;

  const server = http.createServer((req, res) => {
    if (req.url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            files: [{ fileName: "app.js", url: "/assets/app.js", category: "scripts", version: "v2" }],
          },
        }),
      );
      return;
    }

    if (req.url === "/assets/app.js") {
      downloadCount += 1;
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end("console.log('v2');");
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
          publics: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

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

    const result = await runCli(["update", "scripts/app.js", "styles/theme.css"], tempDir);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Target not found in remote assets: styles\/theme\.css/);
    assert.equal(downloadCount, 0);
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("update rejects invalid targets", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "update-public-update-invalid-"));

  try {
    await writeFile(
      path.join(tempDir, "update-public.config.json"),
      `${JSON.stringify(
        {
          baseurl: "https://example.com/api/config",
          publics: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await writeFile(
      path.join(tempDir, "update-public.filter.ts"),
      `export default function filter() {
  return { publics: [] };
}
`,
      "utf8",
    );

    const result = await runCli(["update", "app.js"], tempDir);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Invalid target "app\.js"/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

function runCli(args, workdir, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workdir,
      env: {
        ...process.env,
        ...options.env,
      },
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
