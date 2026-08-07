import { api } from '../../services/api';

export const auditMiddleware = store => next => action => {
  // Capture the action dispatch
  const result = next(action);

  // Debug logging
  console.log('[REDUX AUDIT] Action Dispatched:', action.type);
  console.log('[REDUX AUDIT] State After Dispatch:', store.getState());

  // Intercept specific actions to write logs to backend
  const state = store.getState();
  const token = state.auth?.user?.accessToken;

  if (token) {
    if (action.type === 'auth/setUser' && action.payload) {
      api.writeAuditLog(token, `User ${action.payload.username} authenticated successfully via Redux Store`)
        .catch(err => console.error('[REDUX AUDIT] Failed to save authentication audit trail:', err));
    }
    if (action.type === 'auth/logout') {
      // Note: token might be cleared immediately on logout, so this is best-effort
      console.log('[REDUX AUDIT] User session terminated.');
    }
  }

  return result;
};
