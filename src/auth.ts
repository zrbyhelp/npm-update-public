import type { UpdatePublicConfig } from "./types.js";

const ENV_PATTERN = /\$\{([A-Z0-9_]+)\}/g;

export function buildRequestHeaders(config: UpdatePublicConfig): Record<string, string> {
  const headers = config.auth?.headers;

  if (!headers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, resolveEnvPlaceholders(value)]),
  );
}

function resolveEnvPlaceholders(value: string): string {
  return value.replaceAll(ENV_PATTERN, (_, name: string) => {
    const envValue = process.env[name];

    if (envValue === undefined) {
      throw new Error(`Missing environment variable "${name}" referenced by auth config.`);
    }

    return envValue;
  });
}
