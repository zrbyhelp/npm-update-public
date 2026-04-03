import { stdout } from "node:process";

import { writeConfig } from "../config.js";
import { downloadAsset } from "../download.js";
import { loadRemoteAssets } from "../remote.js";
import { findAssetsByTargets, parseAssetTargets, toAssetKey } from "../targets.js";
import type { PublicAsset } from "../types.js";

export async function updateCommand(cwd: string, targetArgs: string[]): Promise<void> {
  const targets = parseAssetTargets(targetArgs);
  const { config, headers, publics } = await loadRemoteAssets(cwd);
  const { matched, missing } = findAssetsByTargets(publics, targets);

  if (missing.length > 0) {
    throw new Error(`Target not found in remote assets: ${missing.join(", ")}`);
  }

  for (const asset of matched) {
    await downloadAsset(config.baseurl, asset, cwd, headers);
    stdout.write(`UPDATED ${toAssetKey(asset)} version: ${asset.version}\n`);
  }

  const updatedByKey = new Map(matched.map((asset) => [toAssetKey(asset), asset]));
  const mergedPublics = mergeUpdatedAssets(config.publics, matched, updatedByKey);

  await writeConfig(cwd, {
    baseurl: config.baseurl,
    ...(config.auth ? { auth: config.auth } : {}),
    publics: mergedPublics,
  });
}

function mergeUpdatedAssets(
  previousAssets: PublicAsset[],
  matchedAssets: PublicAsset[],
  updatedByKey: Map<string, PublicAsset>,
): PublicAsset[] {
  const preserved = previousAssets.map((asset) => updatedByKey.get(toAssetKey(asset)) ?? asset);
  const existingKeys = new Set(previousAssets.map((asset) => toAssetKey(asset)));
  const added = matchedAssets.filter((asset) => !existingKeys.has(toAssetKey(asset)));

  return [...preserved, ...added];
}
