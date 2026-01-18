import axios from 'axios';
import type {
  UploadResponse,
  OperationResponse,
  SplitResponse,
  ExportQuality,
} from '@/types';

const API_BASE = '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 minutes for large files
});

export const api = {
  // File Upload
  async uploadPDF(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await client.post<UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async uploadImage(file: File): Promise<{ file_id: string; original_name: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await client.post('/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Page Operations
  async removePages(fileId: string, pages: number[]): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/remove-pages', {
      file_id: fileId,
      pages,
    });
    return response.data;
  },

  async reorderPages(fileId: string, newOrder: number[]): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/reorder-pages', {
      file_id: fileId,
      new_order: newOrder,
    });
    return response.data;
  },

  async rotatePages(
    fileId: string,
    pages: number[],
    rotation: number
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/rotate', {
      file_id: fileId,
      pages,
      rotation,
    });
    return response.data;
  },

  async addBlankPage(
    fileId: string,
    position: number,
    pageSize: string = 'A4'
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/add-blank-page', {
      file_id: fileId,
      position,
      page_size: pageSize,
    });
    return response.data;
  },

  // Merge & Split
  async mergePDFs(files: File[]): Promise<OperationResponse> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await client.post<OperationResponse>('/merge', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async appendPDF(fileId: string, file: File): Promise<OperationResponse> {
    const formData = new FormData();
    formData.append('file_id', fileId);
    formData.append('file', file);
    const response = await client.post<OperationResponse>('/append', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async splitPDF(
    fileId: string,
    mode: 'individual' | 'ranges' | 'count',
    ranges?: number[][],
    pagesPerFile?: number
  ): Promise<SplitResponse> {
    const response = await client.post<SplitResponse>('/split', {
      file_id: fileId,
      mode,
      ranges,
      pages_per_file: pagesPerFile,
    });
    return response.data;
  },

  // Image to PDF
  async insertImage(
    fileId: string,
    position: number,
    image: File,
    pageSize: string = 'A4'
  ): Promise<OperationResponse> {
    const formData = new FormData();
    formData.append('file_id', fileId);
    formData.append('position', position.toString());
    formData.append('page_size', pageSize);
    formData.append('image', image);
    const response = await client.post<OperationResponse>('/insert-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async imagesToPDF(images: File[], pageSize: string = 'A4'): Promise<OperationResponse> {
    const formData = new FormData();
    images.forEach((img) => formData.append('files', img));
    formData.append('page_size', pageSize);
    const response = await client.post<OperationResponse>('/image-to-pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Advanced Operations
  async addWatermark(
    fileId: string,
    text: string,
    options: {
      position?: string;
      opacity?: number;
      rotation?: number;
      pages?: number[];
    } = {}
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/watermark', {
      file_id: fileId,
      text,
      ...options,
    });
    return response.data;
  },

  async encryptPDF(
    fileId: string,
    userPassword: string,
    ownerPassword?: string
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/encrypt', {
      file_id: fileId,
      user_password: userPassword,
      owner_password: ownerPassword,
    });
    return response.data;
  },

  async extractText(
    fileId: string,
    pages?: number[],
    format: 'json' | 'txt' = 'json'
  ): Promise<{ text: Record<number, string> } | Blob> {
    const response = await client.post(
      '/extract-text',
      { file_id: fileId, pages, format },
      { responseType: format === 'txt' ? 'blob' : 'json' }
    );
    return response.data;
  },

  async extractTables(
    fileId: string,
    pages?: number[]
  ): Promise<{ tables: Record<number, unknown[][]> }> {
    const response = await client.post('/extract-tables', null, {
      params: { file_id: fileId, pages },
    });
    return response.data;
  },

  async extractImages(fileId: string): Promise<{ images: { file_id: string; filename: string; download_url: string }[] }> {
    const response = await client.post('/extract-images', null, {
      params: { file_id: fileId },
    });
    return response.data;
  },

  // Annotations
  async saveAnnotations(
    fileId: string,
    annotations: Record<number, unknown[]>,
    quality: ExportQuality = 'high'
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/annotate', {
      file_id: fileId,
      annotations,
      quality,
    });
    return response.data;
  },

  // Previews & Downloads
  getThumbnailUrl(fileId: string, pageNum: number): string {
    return `${API_BASE}/thumbnail/${fileId}/${pageNum}?t=${Date.now()}`;
  },

  getPreviewUrl(fileId: string, pageNum: number, dpi: number = 150): string {
    return `${API_BASE}/preview/${fileId}/${pageNum}?dpi=${dpi}&t=${Date.now()}`;
  },

  getDownloadUrl(fileId: string, quality: ExportQuality = 'high'): string {
    return `${API_BASE}/download/${fileId}?quality=${quality}`;
  },

  async deleteFile(fileId: string): Promise<void> {
    await client.delete(`/file/${fileId}`);
  },

  async getFileInfo(fileId: string): Promise<{
    num_pages: number;
    page_sizes: { width: number; height: number }[];
  }> {
    const response = await client.get(`/file/${fileId}/info`);
    return response.data;
  },

  // Form filling
  async getFormFields(fileId: string): Promise<{
    success: boolean;
    fields: Record<string, {
      type: string;
      value: string;
      name: string;
      readonly: boolean;
      options?: string[];
    }>;
    has_forms: boolean;
  }> {
    const response = await client.get(`/form-fields/${fileId}`);
    return response.data;
  },

  async fillForm(
    fileId: string,
    fieldValues: Record<string, string>
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/fill-form', {
      file_id: fileId,
      field_values: fieldValues,
    });
    return response.data;
  },

  // Metadata
  async getMetadata(fileId: string): Promise<{
    success: boolean;
    metadata: {
      title: string;
      author: string;
      subject: string;
      keywords: string;
      creator: string;
      producer: string;
      creation_date: string;
      modification_date: string;
    };
  }> {
    const response = await client.get(`/metadata/${fileId}`);
    return response.data;
  },

  async updateMetadata(
    fileId: string,
    metadata: {
      title?: string;
      author?: string;
      subject?: string;
      keywords?: string;
    }
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/metadata', {
      file_id: fileId,
      ...metadata,
    });
    return response.data;
  },

  // Upload with progress
  async uploadPDFWithProgress(
    file: File,
    onProgress: (progress: number) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await client.post<UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  },

  // ==========================================================================
  // Digital Signatures
  // ==========================================================================

  async getSignatureStatus(): Promise<{ available: boolean; message: string }> {
    const response = await client.get('/signature/status');
    return response.data;
  },

  async getSignatureInfo(fileId: string): Promise<{
    success: boolean;
    has_signatures: boolean;
    signatures: Array<{ field_name: string; is_signed: boolean }>;
    is_certified: boolean;
  }> {
    const response = await client.get(`/signature/info/${fileId}`);
    return response.data;
  },

  async addSignature(
    fileId: string,
    pageNum: number,
    x: number,
    y: number,
    options: {
      name?: string;
      reason?: string;
      location?: string;
      signature_data?: { points: [number, number][] };
    } = {}
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/signature/add', {
      file_id: fileId,
      page_num: pageNum,
      x,
      y,
      ...options,
    });
    return response.data;
  },

  // ==========================================================================
  // OCR
  // ==========================================================================

  async getOCRStatus(): Promise<{
    available: boolean;
    message: string;
    supported_languages: Record<string, string>;
  }> {
    const response = await client.get('/ocr/status');
    return response.data;
  },

  async getOCRLanguages(): Promise<{ languages: Record<string, string> }> {
    const response = await client.get('/ocr/languages');
    return response.data;
  },

  async ocrExtractText(
    fileId: string,
    language: string = 'eng',
    pages?: number[]
  ): Promise<{
    success: boolean;
    text: Record<number, string>;
    language: string;
  }> {
    const response = await client.post('/ocr/extract', {
      file_id: fileId,
      language,
      pages,
    });
    return response.data;
  },

  async ocrCreateSearchable(
    fileId: string,
    language: string = 'eng',
    pages?: number[],
    dpi: number = 300
  ): Promise<OperationResponse> {
    const response = await client.post<OperationResponse>('/ocr/searchable', {
      file_id: fileId,
      language,
      pages,
      dpi,
    });
    return response.data;
  },

  // ==========================================================================
  // Batch Processing
  // ==========================================================================

  async getBatchOperations(): Promise<{ operations: Record<string, string> }> {
    const response = await client.get('/batch/operations');
    return response.data;
  },

  async batchUpload(files: File[]): Promise<{
    success: boolean;
    uploaded: Array<{ file_id: string; original_name: string; num_pages: number }>;
    errors: Array<{ filename: string; error: string }>;
    total_uploaded: number;
    total_errors: number;
  }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await client.post('/batch/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async batchWatermark(
    fileIds: string[],
    text: string,
    opacity: number = 0.3,
    rotation: number = 45
  ): Promise<{
    success: boolean;
    results: Array<{ file_id: string; download_url: string }>;
    errors: Array<{ file_id: string; error: string }>;
  }> {
    const response = await client.post('/batch/watermark', {
      file_ids: fileIds,
      text,
      opacity,
      rotation,
    });
    return response.data;
  },

  async batchEncrypt(
    fileIds: string[],
    password: string
  ): Promise<{
    success: boolean;
    results: Array<{ file_id: string; download_url: string }>;
    errors: Array<{ file_id: string; error: string }>;
  }> {
    const response = await client.post('/batch/encrypt', {
      file_ids: fileIds,
      password,
    });
    return response.data;
  },

  async batchRotate(
    fileIds: string[],
    rotation: number
  ): Promise<{
    success: boolean;
    results: Array<{ file_id: string; download_url: string }>;
    errors: Array<{ file_id: string; error: string }>;
  }> {
    const response = await client.post('/batch/rotate', {
      file_ids: fileIds,
      rotation,
    });
    return response.data;
  },

  async batchExtractText(fileIds: string[]): Promise<{
    success: boolean;
    results: Array<{ file_id: string; text_preview: string; download_url: string }>;
    errors: Array<{ file_id: string; error: string }>;
  }> {
    const response = await client.post('/batch/extract-text', {
      file_ids: fileIds,
    });
    return response.data;
  },

  async batchMerge(fileIds: string[]): Promise<{
    success: boolean;
    results: Array<{ file_id: string; num_pages: number; download_url: string }>;
    errors: Array<{ error: string }>;
  }> {
    const response = await client.post('/batch/merge', {
      file_ids: fileIds,
    });
    return response.data;
  },

  async batchDownloadZip(fileIds: string[]): Promise<{
    success: boolean;
    zip_file_id: string;
    download_url: string;
  }> {
    const response = await client.post('/batch/download-zip', {
      file_ids: fileIds,
    });
    return response.data;
  },
};

export default api;
