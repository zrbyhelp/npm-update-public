import { collectAssetDiff } from "../diff.js";
import { readConfig, writeConfig } from "../config.js";
import { downloadAsset } from "../download.js";
import { ProgressBar } from "../progress.js";
import { loadRemoteAssets } from "../remote.js";

export async function pullCommand(cwd: string): Promise<void> {
  const { config, headers, publics } = await loadRemoteAssets(cwd);
  const diff = collectAssetDiff(config.publics, publics);
  const changedKeys = new Set([
    ...diff.added.map((asset) => `${asset.type}/${asset.name}`),
    ...diff.changed.map((asset) => `${asset.type}/${asset.name}`),
  ]);
  const progress = new ProgressBar(publics.length);

  for (const asset of publics) {
    const changed = changedKeys.has(`${asset.type}/${asset.name}`);

    if (changed) {
      await downloadAsset(config.baseurl, asset, cwd, headers);
      progress.tick(`updated ${asset.type}/${asset.name}`);
      continue;
    }

    progress.tick(`unchanged ${asset.type}/${asset.name}`);
  }

  await writeConfig(cwd, {
    baseurl: config.baseurl,
    ...(config.auth ? { auth: config.auth } : {}),
    publics,
  });
}
