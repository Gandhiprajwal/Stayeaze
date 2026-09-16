package com.stayeaze.backend.controllers;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/v1/system/metrics")
public class SystemMetricsStreamController {

    private static final Logger logger = LoggerFactory.getLogger(SystemMetricsStreamController.class);
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private ScheduledExecutorService executor;

    @Autowired
    private SystemMetricsController metricsController;

    @PostConstruct
    public void init() {
        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sse-metrics-streamer");
            t.setDaemon(true);
            return t;
        });
        executor.scheduleAtFixedRate(this::broadcastMetrics, 2, 2, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void destroy() {
        if (executor != null) {
            executor.shutdown();
        }
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasRole('SUPER_ADMIN') or hasRole('SUPPORT') or hasRole('OWNER') or hasRole('PROPERTY_MANAGER')")
    public SseEmitter streamMetrics() {
        SseEmitter emitter = new SseEmitter(1800000L); // 30 minutes timeout
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError((e) -> emitters.remove(emitter));

        // Push immediate initial snapshot
        try {
            Object metricsData = metricsController.getMetrics().getBody();
            emitter.send(SseEmitter.event().name("metrics").data(metricsData));
        } catch (Exception e) {
            emitters.remove(emitter);
        }

        return emitter;
    }

    private void broadcastMetrics() {
        if (emitters.isEmpty()) {
            return;
        }

        try {
            Object metricsData = metricsController.getMetrics().getBody();
            if (metricsData == null) {
                return;
            }

            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().name("metrics").data(metricsData));
                } catch (Exception e) {
                    emitters.remove(emitter);
                    try {
                        emitter.complete();
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            logger.debug("Error during SSE metrics broadcast: {}", e.getMessage());
        }
    }
}
