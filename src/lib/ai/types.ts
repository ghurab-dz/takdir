// AI provider contract — the rest of the app only ever sees this interface.
// Swapping Gemini <-> OpenRouter <-> any future provider = one new file here.

export interface PhotoInput {
  data: string; // base64, no data: prefix
  mimeType: string; // image/jpeg | image/png | image/webp
}

export interface AllowedItem {
  itemName: string;
  unit: string;
  category: string;
}

export interface ExtractionInput {
  description: string;
  photos: PhotoInput[];
  allowedItems: AllowedItem[];
}

export interface ExtractedItem {
  itemName: string; // MUST be one of allowedItems names
  quantity: number;
  unit: string;
}

export interface ExtractionResult {
  roomType: string | null;
  areaM2: number | null;
  items: ExtractedItem[];
  notes: string | null;
}

export interface RenderItem {
  itemName: string;
  category: string;
  unit: string;
  visualHint?: string | null;
}

export type Tier = "economy" | "mid" | "premium";

export interface AllowedMaterial {
  id: string;
  itemName: string;
  unit: string;
  category: string;
  grade: Tier;
  unitPrice: number;
  visualHint: string | null;
}

export interface GenerateOptionsInput {
  photos: PhotoInput[];
  dims: { lengthM: number | null; widthM: number | null; heightM: number | null; areaM2: number | null };
  styleTags: string[];
  budgetTier: Tier | null;
  budgetDZD: number | null;
  contractorNotes: string | null;
  roomType: string | null;
  description: string;
  allowedMaterials: AllowedMaterial[];
}

export interface GenerateOptionsResult {
  options: {
    tier: Tier;
    title: string;
    items: { itemName: string; quantity: number; unit: string; materialId: string | null; category: string }[];
    rationale: string | null;
  }[];
  roomType: string | null;
  areaM2: number | null;
  notes: string | null;
}

export interface RenderInput {
  basePhoto: PhotoInput;
  items: RenderItem[];
  roomType: string | null;
  tier?: Tier | null;
  styleTags?: string[];
  contractorNotes?: string | null;
}

export interface RenderResult {
  imageBase64: string; // raw base64, no data: prefix
  mimeType: string; // image/jpeg | image/png | image/webp
  model: string;
}

export interface AiProvider {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
  generateOptions(input: GenerateOptionsInput): Promise<GenerateOptionsResult>;
  render(input: RenderInput): Promise<RenderResult>;
}
