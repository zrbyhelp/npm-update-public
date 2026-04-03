import { buildRequestHeaders } from "./auth.js";
import { readConfig } from "./config.js";
import { runFilter } from "./filter.js";
import type { UpdatePublicConfig } from "./types.js";

export interface RemoteAssetSnapshot {
  config: UpdatePublicConfig;
  headers: Record<string, string>;
  publics: UpdatePublicConfig["publics"];
}

export async function loadRemoteAssets(cwd: string): Promise<RemoteAssetSnapshot> {
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

  return {
    config,
    headers,
    publics: filtered.publics,
  };
}
