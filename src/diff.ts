import type { PublicAsset } from "./types.js";

export interface ChangedAssetDiff {
  name: string;
  type: string;
  link: string;
  previousVersion: string;
  nextVersion: string;
}

export interface AssetDiffResult {
  added: PublicAsset[];
  changed: ChangedAssetDiff[];
  removed: PublicAsset[];
}

export function collectAssetDiff(previousAssets: PublicAsset[], nextAssets: PublicAsset[]): AssetDiffResult {
  const previousByKey = new Map(previousAssets.map((asset) => [toAssetKey(asset), asset]));
  const nextByKey = new Map(nextAssets.map((asset) => [toAssetKey(asset), asset]));
  const added: PublicAsset[] = [];
  const changed: ChangedAssetDiff[] = [];
  const removed: PublicAsset[] = [];

  for (const asset of nextAssets) {
    const previousAsset = previousByKey.get(toAssetKey(asset));

    if (!previousAsset) {
      added.push(asset);
      continue;
    }

    if (previousAsset.version !== asset.version) {
      changed.push({
        name: asset.name,
        type: asset.type,
        link: asset.link,
        previousVersion: previousAsset.version,
        nextVersion: asset.version,
      });
    }
  }

  for (const asset of previousAssets) {
    if (!nextByKey.has(toAssetKey(asset))) {
      removed.push(asset);
    }
  }

  return { added, changed, removed };
}

function toAssetKey(asset: PublicAsset): string {
  return `${asset.type}/${asset.name}`;
}
