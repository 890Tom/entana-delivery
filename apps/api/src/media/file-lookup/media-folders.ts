const MEDIA_FOLDERS = ["branding", "products"] as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export function isMediaFolder(value: string): value is MediaFolder {
  return MEDIA_FOLDERS.some((folder) => folder === value);
}
