package com.stayeaze.backend.services.interfaces;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

/**
 * Gateway contract for multi-part file persistence, validation, and storage.
 * Supports local filesystem storage and AWS S3 cloud storage.
 */
public interface IFileStorageService {

    /**
     * Stores an uploaded multipart file in the designated subdirectory.
     * Enforces file extension validation and a 3MB size limit.
     *
     * @param file the multipart file uploaded by user
     * @param subFolder target storage subfolder (e.g., "kyc", "agreements", "receipts")
     * @return the public/internal URL or relative path to access the stored file
     * @throws IOException if I/O error occurs during upload
     * @throws IllegalArgumentException if file validation fails
     */
    String storeFile(MultipartFile file, String subFolder) throws IOException;
}
