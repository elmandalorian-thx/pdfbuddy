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

export interface Annotation {
  id: string;
  type: 'pen' | 'highlighter';
  points: [number, number][];
  color: string;
  width: number;
  opacity: number;
  pageNumber: number;
}

export interface AnnotationsByPage {
  [pageNumber: number]: Annotation[];
}

export type ToolType = 'select' | 'pen' | 'highlighter' | 'eraser';

export interface ToolSettings {
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  highlighterWidth: number;
  highlighterOpacity: number;
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
