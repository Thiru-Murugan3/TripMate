package com.tripmate.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Service
public class SseService {

    private final Map<Long, List<SseEmitter>> userEmitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        // 30 minutes timeout for SSE emitter connection
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);

        userEmitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        Runnable cleanup = () -> removeEmitter(userId, emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> {
            log.debug("SSE emitter error for user {}: {}", userId, e.getMessage());
            removeEmitter(userId, emitter);
        });

        // Send initial connection event
        try {
            emitter.send(SseEmitter.event()
                    .name("INIT")
                    .data("Connected to notification stream for user " + userId));
        } catch (IOException e) {
            removeEmitter(userId, emitter);
        }

        return emitter;
    }

    public void sendToUser(Long userId, String eventName, Object data) {
        List<SseEmitter> emitters = userEmitters.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(data));
            } catch (Exception e) {
                log.debug("Failed to send SSE event to user {}: {}", userId, e.getMessage());
                removeEmitter(userId, emitter);
            }
        }
    }

    private void removeEmitter(Long userId, SseEmitter emitter) {
        List<SseEmitter> list = userEmitters.get(userId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                userEmitters.remove(userId);
            }
        }
    }
}
