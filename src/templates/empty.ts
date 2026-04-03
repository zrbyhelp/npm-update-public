import type { TemplateDefinition } from "../types.js";

export const emptyTemplate: TemplateDefinition = {
  id: "empty",
  name: "Empty template",
  description: "Minimal filter template. Fill in your remote response mapping manually.",
  content: `type RawResponse = unknown;

type FilterOutput = {
  publics: Array<{
    name: string;
    link: string;
    type: string;
    version: string;
  }>;
};

export default function filter(response: RawResponse): FilterOutput {
  void response;

  return {
    publics: [],
  };
}
`,
};
