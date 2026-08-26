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

const errorQueue: TelemetryPayload[] = [];
let dispatchTimer: ReturnType<typeof setTimeout> | null = null;

function flushQueue() {
  if (errorQueue.length === 0) return;
  const batch = [...errorQueue];
  errorQueue.length = 0;

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

  errorQueue.push(payload);
  scheduleFlush();
}

export function reportTelemetryEvent(eventName: string, data?: Record<string, unknown>) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  errorQueue.push({
    eventName,
    category: 'USER_ACTION',
    path,
    metadata: data,
    timestamp: new Date().toISOString(),
  });
  scheduleFlush();
}

export function initFrontendTelemetry() {
  if (typeof window === 'undefined') return;

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
