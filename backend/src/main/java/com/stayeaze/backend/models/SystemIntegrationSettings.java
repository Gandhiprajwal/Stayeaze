package com.stayeaze.backend.models;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "system_integration_settings")
public class SystemIntegrationSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    // Redis Configuration
    @Column(name = "redis_enabled")
    private Boolean redisEnabled = false;

    @Column(name = "redis_host", length = 200)
    private String redisHost = "localhost";

    @Column(name = "redis_port")
    private Integer redisPort = 6379;

    @Column(name = "redis_password", length = 200)
    private String redisPassword;

    // AWS S3 Configuration
    @Column(name = "aws_s3_enabled")
    private Boolean awsS3Enabled = false;

    @Column(name = "aws_access_key", length = 200)
    private String awsAccessKey;

    @Column(name = "aws_secret_key", length = 200)
    private String awsSecretKey;

    @Column(name = "aws_region", length = 100)
    private String awsRegion = "ap-south-1";

    @Column(name = "aws_bucket_name", length = 150)
    private String awsBucketName = "stayeaze-media-storage";

    // Rate Limiting & Security
    @Column(name = "rate_limiting_enabled")
    private Boolean rateLimitingEnabled = true;

    @Column(name = "max_requests_per_sec")
    private Integer maxRequestsPerSec = 50;

    @Column(name = "auth_brute_force_limit_per_min")
    private Integer authBruteForceLimitPerMin = 5;

    // Razorpay Master Keys Override
    @Column(name = "razorpay_master_key_id", length = 150)
    private String razorpayMasterKeyId;

    @Column(name = "razorpay_master_key_secret", length = 150)
    private String razorpayMasterKeySecret;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public SystemIntegrationSettings() {}

    public UUID getId() { return id; }
    public Boolean getRedisEnabled() { return redisEnabled != null ? redisEnabled : false; }
    public void setRedisEnabled(Boolean redisEnabled) { this.redisEnabled = redisEnabled; }

    public String getRedisHost() { return redisHost; }
    public void setRedisHost(String redisHost) { this.redisHost = redisHost; }

    public Integer getRedisPort() { return redisPort != null ? redisPort : 6379; }
    public void setRedisPort(Integer redisPort) { this.redisPort = redisPort; }

    public String getRedisPassword() { return redisPassword; }
    public void setRedisPassword(String redisPassword) { this.redisPassword = redisPassword; }

    public Boolean getAwsS3Enabled() { return awsS3Enabled != null ? awsS3Enabled : false; }
    public void setAwsS3Enabled(Boolean awsS3Enabled) { this.awsS3Enabled = awsS3Enabled; }

    public String getAwsAccessKey() { return awsAccessKey; }
    public void setAwsAccessKey(String awsAccessKey) { this.awsAccessKey = awsAccessKey; }

    public String getAwsSecretKey() { return awsSecretKey; }
    public void setAwsSecretKey(String awsSecretKey) { this.awsSecretKey = awsSecretKey; }

    public String getAwsRegion() { return awsRegion; }
    public void setAwsRegion(String awsRegion) { this.awsRegion = awsRegion; }

    public String getAwsBucketName() { return awsBucketName; }
    public void setAwsBucketName(String awsBucketName) { this.awsBucketName = awsBucketName; }

    public Boolean getRateLimitingEnabled() { return rateLimitingEnabled != null ? rateLimitingEnabled : true; }
    public void setRateLimitingEnabled(Boolean rateLimitingEnabled) { this.rateLimitingEnabled = rateLimitingEnabled; }

    public Integer getMaxRequestsPerSec() { return maxRequestsPerSec != null ? maxRequestsPerSec : 50; }
    public void setMaxRequestsPerSec(Integer maxRequestsPerSec) { this.maxRequestsPerSec = maxRequestsPerSec; }

    public Integer getAuthBruteForceLimitPerMin() { return authBruteForceLimitPerMin != null ? authBruteForceLimitPerMin : 5; }
    public void setAuthBruteForceLimitPerMin(Integer authBruteForceLimitPerMin) { this.authBruteForceLimitPerMin = authBruteForceLimitPerMin; }

    public String getRazorpayMasterKeyId() { return razorpayMasterKeyId; }
    public void setRazorpayMasterKeyId(String razorpayMasterKeyId) { this.razorpayMasterKeyId = razorpayMasterKeyId; }

    public String getRazorpayMasterKeySecret() { return razorpayMasterKeySecret; }
    public void setRazorpayMasterKeySecret(String razorpayMasterKeySecret) { this.razorpayMasterKeySecret = razorpayMasterKeySecret; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
