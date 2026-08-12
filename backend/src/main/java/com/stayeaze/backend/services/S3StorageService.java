package com.stayeaze.backend.services;

import com.stayeaze.backend.models.SystemIntegrationSettings;
import com.stayeaze.backend.repository.SystemIntegrationSettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class S3StorageService {

    private static final Logger logger = LoggerFactory.getLogger(S3StorageService.class);

    @Autowired
    private SystemIntegrationSettingsRepository settingsRepository;

    public String generateFileStorageUrl(String folder, String filename) {
        SystemIntegrationSettings settings = settingsRepository.findAll().stream().findFirst().orElse(null);

        if (settings != null && Boolean.TRUE.equals(settings.getAwsS3Enabled()) 
            && settings.getAwsBucketName() != null && !settings.getAwsBucketName().isBlank()
            && settings.getAwsAccessKey() != null && !settings.getAwsAccessKey().isBlank()) {
            
            String bucket = settings.getAwsBucketName();
            String region = settings.getAwsRegion() != null ? settings.getAwsRegion() : "ap-south-1";
            logger.info("Generating AWS S3 Cloud Storage URL for bucket {}", bucket);
            return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + folder + "/" + UUID.randomUUID().toString() + "-" + filename;
        }

        // Default Fallback Storage URL
        return "https://stayeaze-media.s3.ap-south-1.amazonaws.com/" + folder + "/" + filename;
    }
}
