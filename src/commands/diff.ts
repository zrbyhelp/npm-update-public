import { stdout } from "node:process";

import { collectAssetDiff } from "../diff.js";
import { loadRemoteAssets } from "../remote.js";

interface DiffCommandOptions {
  json?: boolean;
}

export async function diffCommand(cwd: string, options: DiffCommandOptions = {}): Promise<void> {
  const snapshot = await loadRemoteAssets(cwd);
  const diff = collectAssetDiff(snapshot.config.publics, snapshot.publics);

  if (options.json) {
    stdout.write(`${JSON.stringify(diff, null, 2)}\n`);
    return;
  }

  const sections = [
    ...diff.added.map((asset) => `ADDED ${asset.type}/${asset.name} version: ${asset.version}`),
    ...diff.changed.map(
      (asset) => `CHANGED ${asset.type}/${asset.name} version: ${asset.previousVersion} -> ${asset.nextVersion}`,
    ),
    ...diff.removed.map((asset) => `REMOVED ${asset.type}/${asset.name} version: ${asset.version}`),
  ];

  if (sections.length === 0) {
    stdout.write("No differences found.\n");
    return;
  }

  stdout.write(`${sections.join("\n")}\n`);
}
