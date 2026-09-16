package com.stayeaze.backend.controllers;

import com.stayeaze.backend.security.ApiMetricsFilter;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/super-admin/api-metrics")
@CrossOrigin(origins = "*", maxAge = 3600)
public class SuperAdminApiMetricsController {

    private static final Logger logger = LoggerFactory.getLogger(SuperAdminApiMetricsController.class);
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private ScheduledExecutorService executor;

    @PostConstruct
    public void init() {
        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sse-api-metrics-streamer");
            t.setDaemon(true);
            return t;
        });
        executor.scheduleAtFixedRate(this::broadcastApiMetrics, 2, 2, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void destroy() {
        if (executor != null) {
            executor.shutdown();
        }
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('SUPPORT')")
    public ResponseEntity<?> getMetricsSnapshot() {
        Map<String, Object> metrics = ApiMetricsFilter.getMetricsSnapshot();
        return ResponseEntity.ok(metrics);
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('SUPPORT')")
    public SseEmitter streamApiMetrics() {
        SseEmitter emitter = new SseEmitter(1800000L); // 30 minutes timeout
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError((e) -> emitters.remove(emitter));

        // Push immediate initial snapshot
        try {
            Map<String, Object> metrics = ApiMetricsFilter.getMetricsSnapshot();
            emitter.send(SseEmitter.event().name("api-metrics").data(metrics));
        } catch (Exception e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    private void broadcastApiMetrics() {
        if (emitters.isEmpty()) {
            return;
        }

        try {
            Map<String, Object> metrics = ApiMetricsFilter.getMetricsSnapshot();
            if (metrics == null) {
                return;
            }

            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().name("api-metrics").data(metrics));
                } catch (Exception e) {
                    emitters.remove(emitter);
                    try {
                        emitter.complete();
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            logger.debug("Error during SSE API metrics broadcast: {}", e.getMessage());
        }
    }

    @PostMapping("/reset")
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('SUPPORT')")
    public ResponseEntity<?> resetMetrics() {
        ApiMetricsFilter.resetMetrics();
        broadcastApiMetrics();
        Map<String, Object> res = new HashMap<>();
        res.put("message", "API Metrics reset successfully.");
        return ResponseEntity.ok(res);
    }
}
