import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { PublicAsset } from "./types.js";

export async function downloadAsset(baseurl: string, asset: PublicAsset, cwd: string): Promise<void> {
  const fileUrl = resolveAssetUrl(baseurl, asset.link);
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to download ${asset.name} from ${fileUrl}: ${response.status} ${response.statusText}`);
  }

  const targetPath = join(cwd, asset.type, asset.name);
  await mkdir(dirname(targetPath), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(targetPath, buffer);
}

function resolveAssetUrl(baseurl: string, link: string): string {
  try {
    return new URL(link).toString();
  } catch {
    return new URL(link, baseurl).toString();
  }
}
