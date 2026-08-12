package com.stayeaze.backend.services;

import com.stayeaze.backend.models.SystemIntegrationSettings;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Logger logger = LoggerFactory.getLogger(FileStorageService.class);

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    public String storeFile(MultipartFile file, String subFolder) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Cannot store empty file.");
        }

        String folder = (subFolder != null && !subFolder.isBlank()) ? subFolder.replaceAll("[^a-zA-Z0-9_-]", "") : "kyc";

        SystemIntegrationSettings settings = null;
        try {
            settings = settingsRepository.findAll().stream().findFirst().orElse(null);
        } catch (Exception e) {
            logger.warn("Could not load SystemIntegrationSettings: {}", e.getMessage());
        }

        boolean s3Enabled = settings != null && Boolean.TRUE.equals(settings.getAwsS3Enabled()) 
                && settings.getAwsAccessKey() != null && !settings.getAwsAccessKey().isBlank()
                && settings.getAwsSecretKey() != null && !settings.getAwsSecretKey().isBlank();

        if (s3Enabled) {
            try {
                // If AWS S3 is enabled and credentials configured, attempt S3 upload
                logger.info("AWS S3 is enabled. Attempting upload to bucket {}...", settings.getAwsBucketName());
                return storeToS3(file, folder, settings);
            } catch (Exception e) {
                logger.warn("S3 upload failed ({}), falling back to local file storage...", e.getMessage());
            }
        }

        // Fallback to local storage inside project /uploads directory
        return storeLocally(file, folder);
    }

    private String storeLocally(MultipartFile file, String folder) throws IOException {
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        }

        String sanitizedBaseName = (originalFilename != null ? originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_") : "file");
        String uniqueFileName = UUID.randomUUID().toString() + "_" + sanitizedBaseName;

        Path uploadPath = Paths.get("uploads", folder).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);

        Path targetLocation = uploadPath.resolve(uniqueFileName);
        Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);

        String relativeUrl = "/uploads/" + folder + "/" + uniqueFileName;
        logger.info("Successfully saved file locally at {}", relativeUrl);
        return relativeUrl;
    }

    private String storeToS3(MultipartFile file, String folder, SystemIntegrationSettings settings) throws Exception {
        // Reserved for S3 SDK integration when S3 credentials are functional
        // For now fallback to local if S3 client is uninitialized
        throw new UnsupportedOperationException("S3 SDK client uninitialized. Using local fallback.");
    }
}
