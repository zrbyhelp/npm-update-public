import { access } from "node:fs/promises";
import { join } from "node:path";

import { configExists, createDefaultConfig, writeConfig } from "../config.js";
import { FILTER_FILE_NAME } from "../constants.js";
import { ask } from "../prompt.js";
import { getTemplateById, selectTemplate, writeTemplate } from "../templates.js";

interface InitOptions {
  baseurl?: string;
  templateId?: string;
}

export async function initCommand(cwd: string, options: InitOptions = {}): Promise<void> {
  const hasConfig = await configExists(cwd);
  const hasFilter = await filterFileExists(cwd);

  if (hasConfig || hasFilter) {
    const existing = [
      hasConfig ? "update-public.config.json" : null,
      hasFilter ? FILTER_FILE_NAME : null,
    ].filter(Boolean);

    throw new Error(`Refusing to overwrite existing file(s): ${existing.join(", ")}`);
  }

  const baseurl = options.baseurl?.trim() || (await ask("Base API URL (can be edited later): ")).trim();
  await writeConfig(cwd, {
    ...createDefaultConfig(),
    baseurl,
  });
  const template = options.templateId ? getTemplateById(options.templateId) : await selectTemplate();
  await writeTemplate(cwd, template);
}

async function filterFileExists(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, FILTER_FILE_NAME));
    return true;
  } catch {
    return false;
  }
}
