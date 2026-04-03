export interface PublicAsset {
  name: string;
  link: string;
  type: string;
  version: string;
}

export interface RequestAuthConfig {
  headers?: Record<string, string>;
}

export interface UpdatePublicConfig {
  baseurl: string;
  auth?: RequestAuthConfig;
  publics: PublicAsset[];
}

export interface FilterOutput {
  publics: PublicAsset[];
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
}
