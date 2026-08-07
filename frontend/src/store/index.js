import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import propertyReducer from './slices/propertySlice';
import tenantReducer from './slices/tenantSlice';
import billingReducer from './slices/billingSlice';
import maintenanceReducer from './slices/maintenanceSlice';
import securityReducer from './slices/securitySlice';
import adminReducer from './slices/adminSlice';
import { auditMiddleware } from './middleware/auditMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    property: propertyReducer,
    tenant: tenantReducer,
    billing: billingReducer,
    maintenance: maintenanceReducer,
    security: securityReducer,
    admin: adminReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(auditMiddleware)
});
