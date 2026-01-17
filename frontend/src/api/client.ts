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
};

export default api;
