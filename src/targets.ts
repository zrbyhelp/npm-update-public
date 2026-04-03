import type { PublicAsset } from "./types.js";

export function toAssetKey(asset: PublicAsset): string {
  return `${asset.type}/${asset.name}`;
}

export function parseAssetTargets(values: string[]): string[] {
  if (values.length === 0) {
    throw new Error("At least one target must be provided. Use type/name, for example scripts/app.js.");
  }

  const uniqueTargets = new Set<string>();

  for (const value of values) {
    validateAssetTarget(value);
    uniqueTargets.add(value);
  }

  return [...uniqueTargets];
}

export function findAssetsByTargets(assets: PublicAsset[], targets: string[]): {
  matched: PublicAsset[];
  missing: string[];
} {
  const byKey = new Map(assets.map((asset) => [toAssetKey(asset), asset]));
  const matched: PublicAsset[] = [];
  const missing: string[] = [];

  for (const target of targets) {
    const asset = byKey.get(target);

    if (!asset) {
      missing.push(target);
      continue;
    }

    matched.push(asset);
  }

  return { matched, missing };
}

function validateAssetTarget(value: string): void {
  if (!value.includes("/")) {
    throw new Error(`Invalid target "${value}". Use type/name, for example scripts/app.js.`);
  }

  const slashIndex = value.indexOf("/");
  const type = value.slice(0, slashIndex).trim();
  const name = value.slice(slashIndex + 1).trim();

  if (type === "" || name === "") {
    throw new Error(`Invalid target "${value}". Use type/name, for example scripts/app.js.`);
  }
}
