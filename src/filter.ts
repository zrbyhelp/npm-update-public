import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

import { FILTER_FILE_NAME } from "./constants.js";
import type { FilterOutput, PublicAsset } from "./types.js";

interface FilterModule {
  default?: (response: unknown) => FilterOutput | Promise<FilterOutput>;
}

export async function filterExists(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, FILTER_FILE_NAME));
    return true;
  } catch {
    return false;
  }
}

export async function runFilter(cwd: string, response: unknown): Promise<FilterOutput> {
  const filterPath = join(cwd, FILTER_FILE_NAME);
  const filterUrl = pathToFileURL(filterPath);
  filterUrl.searchParams.set("ts", Date.now().toString());

  let imported: FilterModule;

  try {
    imported = (await import(filterUrl.href)) as FilterModule;
  } catch (error) {
    throw new Error(
      `Failed to load ${FILTER_FILE_NAME}. Node.js 24+ is required because the filter is executed as TypeScript.`,
      { cause: error },
    );
  }

  if (typeof imported.default !== "function") {
    throw new Error(`${FILTER_FILE_NAME} must export a default function.`);
  }

  const result = await imported.default(response);
  return validateFilterOutput(result);
}

function validateFilterOutput(value: unknown): FilterOutput {
  if (!isRecord(value)) {
    throw new Error("Filter output must be an object.");
  }

  const { publics } = value;

  if (!Array.isArray(publics)) {
    throw new Error('Filter output must include a "publics" array.');
  }

  return {
    publics: publics.map((item, index) => validatePublicAsset(item, index)),
  };
}

function validatePublicAsset(value: unknown, index: number): PublicAsset {
  if (!isRecord(value)) {
    throw new Error(`Filter output publics[${index}] must be an object.`);
  }

  const { name, link, type, version } = value;

  if (typeof name !== "string" || name.trim() === "") {
    throw new Error(`Filter output publics[${index}].name must be a non-empty string.`);
  }

  if (typeof link !== "string" || link.trim() === "") {
    throw new Error(`Filter output publics[${index}].link must be a non-empty string.`);
  }

  if (typeof type !== "string" || type.trim() === "") {
    throw new Error(`Filter output publics[${index}].type must be a non-empty string.`);
  }

  if (typeof version !== "string" || version.trim() === "") {
    throw new Error(`Filter output publics[${index}].version must be a non-empty string.`);
  }

  return { name, link, type, version };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
