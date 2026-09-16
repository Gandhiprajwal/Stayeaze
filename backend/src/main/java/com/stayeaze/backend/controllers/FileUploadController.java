package com.stayeaze.backend.controllers;

import com.stayeaze.backend.payload.response.MessageResponse;
import com.stayeaze.backend.services.FileStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/files")
public class FileUploadController {

    @Autowired
    private FileStorageService fileStorageService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> uploadFile(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "kyc") String folder,
            jakarta.servlet.http.HttpServletRequest request) {
        try {
            MultipartFile effectiveFile = file;
            if (effectiveFile == null && request instanceof org.springframework.web.multipart.MultipartHttpServletRequest multipartRequest) {
                effectiveFile = multipartRequest.getFile("document");
                if (effectiveFile == null) effectiveFile = multipartRequest.getFile("image");
                if (effectiveFile == null) effectiveFile = multipartRequest.getFile("attachment");
                if (effectiveFile == null && !multipartRequest.getFileMap().isEmpty()) {
                    effectiveFile = multipartRequest.getFileMap().values().iterator().next();
                }
            }

            if (effectiveFile == null || effectiveFile.isEmpty()) {
                return ResponseEntity.badRequest().body(new MessageResponse("Error: No file uploaded or file is empty."));
            }

            String fileUrl = fileStorageService.storeFile(effectiveFile, folder);
            Map<String, Object> response = new HashMap<>();
            response.put("fileUrl", fileUrl);
            response.put("fileName", effectiveFile.getOriginalFilename());
            response.put("size", effectiveFile.getSize());
            response.put("contentType", effectiveFile.getContentType());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | SecurityException e) {
            return ResponseEntity.badRequest().body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error uploading file: " + e.getMessage()));
        }
    }
}
