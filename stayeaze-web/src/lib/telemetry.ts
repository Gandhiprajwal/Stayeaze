import api from './api';

export interface TelemetryPayload {
  eventName: string;
  category?: 'UI_ERROR' | 'NETWORK_ERROR' | 'USER_ACTION' | 'PERFORMANCE';
  message?: string;
  stack?: string;
  path?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

const MAX_QUEUE_SIZE = 200;
const errorQueue: TelemetryPayload[] = [];
let dispatchTimer: ReturnType<typeof setTimeout> | null = null;
let isTelemetryInitialized = false;

function flushQueue() {
  if (errorQueue.length === 0) return;
  const batch = errorQueue.splice(0, 50);

  // Dispatch batch to backend telemetry
  api.post('/super-admin/user-tracking/telemetry', { events: batch })
    .catch(() => {
      // Fail silently to avoid cascading error loops in client
    });
}

function scheduleFlush() {
  if (dispatchTimer) return;
  dispatchTimer = setTimeout(() => {
    dispatchTimer = null;
    flushQueue();
  }, 2000);
}

function pushToQueue(payload: TelemetryPayload) {
  if (errorQueue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest entries to maintain fixed memory ceiling
    errorQueue.splice(0, errorQueue.length - MAX_QUEUE_SIZE + 1);
  }
  errorQueue.push(payload);
  scheduleFlush();
}

export function reportFrontendError(error: Error | string, context?: Record<string, unknown>) {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'object' && error.stack ? error.stack : undefined;
  const path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  const payload: TelemetryPayload = {
    eventName: 'CLIENT_EXCEPTION',
    category: 'UI_ERROR',
    message,
    stack,
    path,
    metadata: {
      ...context,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    },
    timestamp: new Date().toISOString(),
  };

  pushToQueue(payload);
}

export function reportTelemetryEvent(eventName: string, data?: Record<string, unknown>) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  pushToQueue({
    eventName,
    category: 'USER_ACTION',
    path,
    metadata: data,
    timestamp: new Date().toISOString(),
  });
}

export function initFrontendTelemetry() {
  if (typeof window === 'undefined' || isTelemetryInitialized) return;
  isTelemetryInitialized = true;

  // Uncaught exceptions
  window.addEventListener('error', (event) => {
    reportFrontendError(event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Unhandled Promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    reportFrontendError(reason instanceof Error ? reason : `Unhandled Promise: ${msg}`, {
      type: 'unhandledrejection',
    });
  });
}
