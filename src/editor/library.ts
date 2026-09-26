import type { MediaAsset } from "./types";

export type LibrarySection = "mine" | "kiro" | "favorites" | "recent";
export type LibraryTier = "free" | "plus";
export type LibraryCategory =
  | "video"
  | "image"
  | "audio"
  | "overlay"
  | "template";

export interface KiroLibraryItem extends MediaAsset {
  source: "kiro";
  tier: LibraryTier;
  category: LibraryCategory;
  tags: string[];
  collection?: string;
}

export interface KiroLibraryResponse {
  version: 1;
  scope: "public";
  items: KiroLibraryItem[];
  categories: LibraryCategory[];
}

const allowedTypes = new Set(["video", "audio", "image"]);
const allowedTiers = new Set(["free", "plus"]);
const allowedCategories = new Set([
  "video",
  "image",
  "audio",
  "overlay",
  "template",
]);

export function parseKiroLibraryResponse(value: unknown): KiroLibraryResponse {
  if (!value || typeof value !== "object")
    throw new Error("Resposta inválida da KIRO Library.");

  const candidate = value as Partial<KiroLibraryResponse>;
  if (candidate.version !== 1 || candidate.scope !== "public")
    throw new Error("Versão incompatível da KIRO Library.");
  if (!Array.isArray(candidate.items))
    throw new Error("Catálogo inválido da KIRO Library.");

  const items = candidate.items.filter((item): item is KiroLibraryItem => {
    if (!item || typeof item !== "object") return false;
    return (
      typeof item.id === "string" &&
      item.id.startsWith("kiro:") &&
      typeof item.name === "string" &&
      typeof item.path === "string" &&
      allowedTypes.has(item.type) &&
      item.source === "kiro" &&
      allowedTiers.has(item.tier) &&
      allowedCategories.has(item.category) &&
      Array.isArray(item.tags)
    );
  });

  return {
    version: 1,
    scope: "public",
    items,
    categories: Array.isArray(candidate.categories)
      ? candidate.categories.filter((category): category is LibraryCategory =>
          allowedCategories.has(category),
        )
      : ["video", "image", "audio", "overlay", "template"],
  };
}

export function libraryAssetLabel(item: KiroLibraryItem) {
  if (item.category === "overlay") return "Overlay";
  if (item.category === "template") return "Template";
  if (item.type === "audio") return "Áudio";
  if (item.type === "image") return "Imagem";
  return "Vídeo";
}
