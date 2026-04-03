export interface PublicAsset {
  name: string;
  link: string;
  type: string;
  version: string;
}

export interface UpdatePublicConfig {
  baseurl: string;
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
