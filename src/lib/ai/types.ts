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

export interface AiProvider {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}
