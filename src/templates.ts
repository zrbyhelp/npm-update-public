import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stdout as output } from "node:process";

import { FILTER_FILE_NAME } from "./constants.js";
import { ask } from "./prompt.js";
import { templates } from "./templates/index.js";
import type { TemplateDefinition } from "./types.js";

export function getTemplates(): TemplateDefinition[] {
  return templates;
}

export function getTemplateById(templateId: string): TemplateDefinition {
  const template = templates.find((item) => item.id === templateId);

  if (!template) {
    const availableIds = templates.map((item) => item.id).join(", ");
    throw new Error(`Unknown template "${templateId}". Available templates: ${availableIds}`);
  }

  return template;
}

export async function selectTemplate(): Promise<TemplateDefinition> {
  if (templates.length === 0) {
    throw new Error("No filter templates are registered.");
  }

  if (templates.length === 1) {
    return templates[0]!;
  }

  output.write("Select a filter template:\n");
  templates.forEach((template, index) => {
    output.write(`${index + 1}. ${template.name} - ${template.description}\n`);
  });

  const answer = await ask("Template number: ");
  const selectedIndex = Number.parseInt(answer.trim(), 10) - 1;

  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= templates.length) {
    throw new Error("Invalid template selection.");
  }

  return templates[selectedIndex]!;
}

export async function writeTemplate(cwd: string, template: TemplateDefinition): Promise<void> {
  const targetPath = join(cwd, FILTER_FILE_NAME);
  await writeFile(targetPath, template.content, "utf8");
}
