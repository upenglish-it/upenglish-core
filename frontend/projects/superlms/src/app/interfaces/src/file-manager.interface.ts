/**
 * File Manager Data Types
 *
 * @file          file-manager.endpoints.datatypes
 * @description   Defines all endpoint data types associated with /api/file-manager/*
 * @author        John Mark Alicante
 * @since         2025 - 10 - 20
 */

/**
 * @interface     FileManagerI
 * @description   File manager detail interface
 */
export interface FileManagerI {
  success: boolean;
  fileName: string;
  data: {
    // ETag: string;
    // ServerSideEncryption: string;
    // Location: string;
    cdn: string;
    // key: string;
    // Key: string;
    // Bucket: string;
  };
}
