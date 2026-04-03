import { buildRequestHeaders } from "../auth.js";
import { readConfig, writeConfig } from "../config.js";
import { downloadAsset } from "../download.js";
import { runFilter } from "../filter.js";
import { ProgressBar } from "../progress.js";
import type { PublicAsset } from "../types.js";

export async function pullCommand(cwd: string): Promise<void> {
  const config = await readConfig(cwd);

  if (config.baseurl.trim() === "") {
    throw new Error('Config "baseurl" cannot be empty.');
  }

  const headers = buildRequestHeaders(config);
  const response = await fetch(config.baseurl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${config.baseurl}: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  const filtered = await runFilter(cwd, payload);
  const previousAssets = new Map(config.publics.map((asset) => [toAssetKey(asset), asset]));
  const progress = new ProgressBar(filtered.publics.length);

  for (const asset of filtered.publics) {
    const previousAsset = previousAssets.get(toAssetKey(asset));
    const changed = hasAssetChanged(previousAsset, asset);

    if (changed) {
      await downloadAsset(config.baseurl, asset, cwd, headers);
      progress.tick(`updated ${asset.type}/${asset.name}`);
      continue;
    }

    progress.tick(`unchanged ${asset.type}/${asset.name}`);
  }

  await writeConfig(cwd, {
    baseurl: config.baseurl,
    publics: filtered.publics,
  });
}

function toAssetKey(asset: PublicAsset): string {
  return `${asset.type}/${asset.name}`;
}

function hasAssetChanged(previous: PublicAsset | undefined, next: PublicAsset): boolean {
  if (!previous) {
    return true;
  }

  return previous.version !== next.version;
}
