import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { CONFIG_FILE_NAME } from "./constants.js";
import type { RequestAuthConfig, UpdatePublicConfig } from "./types.js";

export function createDefaultConfig(): UpdatePublicConfig {
  return {
    baseurl: "",
    publics: [],
  };
}

export async function configExists(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, CONFIG_FILE_NAME));
    return true;
  } catch {
    return false;
  }
}

export async function readConfig(cwd: string): Promise<UpdatePublicConfig> {
  const configPath = join(cwd, CONFIG_FILE_NAME);
  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<UpdatePublicConfig>;
  const auth = validateAuthConfig(parsed.auth);

  if (typeof parsed.baseurl !== "string") {
    throw new Error(`Invalid config: "baseurl" must be a string in ${CONFIG_FILE_NAME}.`);
  }

  if (!Array.isArray(parsed.publics)) {
    throw new Error(`Invalid config: "publics" must be an array in ${CONFIG_FILE_NAME}.`);
  }

  return {
    baseurl: parsed.baseurl,
    publics: parsed.publics.map((item, index) => validatePublicAsset(item, index)),
    ...(auth ? { auth } : {}),
  };
}

export async function writeConfig(cwd: string, config: UpdatePublicConfig): Promise<void> {
  const configPath = join(cwd, CONFIG_FILE_NAME);
  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, `${content}\n`, "utf8");
}

function validatePublicAsset(value: unknown, index: number): UpdatePublicConfig["publics"][number] {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid config: publics[${index}] must be an object in ${CONFIG_FILE_NAME}.`);
  }

  const asset = value as Record<string, unknown>;

  if (typeof asset.name !== "string" || asset.name.trim() === "") {
    throw new Error(`Invalid config: publics[${index}].name must be a non-empty string in ${CONFIG_FILE_NAME}.`);
  }

  if (typeof asset.link !== "string" || asset.link.trim() === "") {
    throw new Error(`Invalid config: publics[${index}].link must be a non-empty string in ${CONFIG_FILE_NAME}.`);
  }

  if (typeof asset.type !== "string" || asset.type.trim() === "") {
    throw new Error(`Invalid config: publics[${index}].type must be a non-empty string in ${CONFIG_FILE_NAME}.`);
  }

  if (typeof asset.version !== "string" || asset.version.trim() === "") {
    throw new Error(`Invalid config: publics[${index}].version must be a non-empty string in ${CONFIG_FILE_NAME}.`);
  }

  return {
    name: asset.name,
    link: asset.link,
    type: asset.type,
    version: asset.version,
  };
}

function validateAuthConfig(value: unknown): RequestAuthConfig | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid config: "auth" must be an object in ${CONFIG_FILE_NAME}.`);
  }

  const auth = value as Record<string, unknown>;

  if (auth.headers === undefined) {
    return {};
  }

  if (typeof auth.headers !== "object" || auth.headers === null || Array.isArray(auth.headers)) {
    throw new Error(`Invalid config: "auth.headers" must be an object in ${CONFIG_FILE_NAME}.`);
  }

  const headers: Record<string, string> = {};

  for (const [key, headerValue] of Object.entries(auth.headers)) {
    if (typeof headerValue !== "string") {
      throw new Error(`Invalid config: "auth.headers.${key}" must be a string in ${CONFIG_FILE_NAME}.`);
    }

    headers[key] = headerValue;
  }

  return { headers };
}
