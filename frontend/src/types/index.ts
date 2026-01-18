export interface PageInfo {
  id: string;
  pageNumber: number;
  thumbnailUrl: string;
  width: number;
  height: number;
  rotation: number;
  selected: boolean;
}

export interface PDFDocument {
  fileId: string;
  originalName: string;
  numPages: number;
  pages: PageInfo[];
  pageSizes: { width: number; height: number }[];
}

export interface BaseAnnotation {
  id: string;
  pageNumber: number;
}

export interface DrawAnnotation extends BaseAnnotation {
  type: 'pen' | 'highlighter';
  points: [number, number][];
  color: string;
  width: number;
  opacity: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export type Annotation = DrawAnnotation | TextAnnotation;

export interface AnnotationsByPage {
  [pageNumber: number]: Annotation[];
}

export type ToolType = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text';

export interface TextSettings {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface ToolSettings {
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  highlighterWidth: number;
  highlighterOpacity: number;
  text: TextSettings;
}

export interface UploadResponse {
  file_id: string;
  original_name: string;
  num_pages: number;
  page_sizes: { width: number; height: number }[];
  thumbnail_urls: string[];
}

export interface OperationResponse {
  success: boolean;
  file_id: string;
  num_pages?: number;
  thumbnail_urls?: string[];
  message?: string;
}

export interface SplitFile {
  file_id: string;
  filename: string;
  download_url: string;
}

export interface SplitResponse {
  success: boolean;
  split_files: SplitFile[];
}

export type ExportQuality = 'standard' | 'high' | 'maximum';

export interface UndoAction {
  type: 'reorder' | 'remove' | 'rotate' | 'annotation';
  previousState: unknown;
  description: string;
}

// Smart Commands Types
export interface ParsedCommandResponse {
  success: boolean;
  intent: string;
  parameters: Record<string, unknown>;
  confidence: number;
  action_preview: string;
  api_endpoint: string;
  api_payload: Record<string, unknown>;
  is_destructive: boolean;
  requires_confirmation: boolean;
  warnings: string[];
  suggestions: string[];
}

export interface ExecuteCommandResponse {
  success: boolean;
  message: string;
  result?: Record<string, unknown>;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  intent: string;
  category: string;
}

export interface CommandCapabilities {
  categories: Record<string, CommandSuggestion[]>;
  total_commands: number;
}
