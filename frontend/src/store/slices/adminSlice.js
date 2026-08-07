import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchAdminDetails = createAsyncThunk(
  'admin/fetchAdminDetails',
  async (token, { rejectWithValue }) => {
    try {
      const conf = await api.getSystemConfig(token).catch(() => null);
      const notifs = await api.getNotificationLogs(token).catch(() => []);
      const audits = await api.getAuditLogs(token).catch(() => []);

      return { config: conf, notifications: notifs, audits: audits };
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch admin dashboard.');
    }
  }
);

export const saveSystemConfigThunk = createAsyncThunk(
  'admin/saveSystemConfigThunk',
  async ({ token, smsProvider, emailProvider, allowSelfRegistration, maintenanceMode }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.updateSystemConfig(token, smsProvider, emailProvider, allowSelfRegistration, maintenanceMode);
      await api.writeAuditLog(token, 'Updated system settings configurations');
      dispatch(fetchAdminDetails(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save config.');
    }
  }
);

export const sendNotificationThunk = createAsyncThunk(
  'admin/sendNotificationThunk',
  async ({ token, recipient, type, messageContent }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createNotification(token, recipient, type, messageContent);
      await api.writeAuditLog(token, `Dispatched message alert template to ${recipient}`);
      dispatch(fetchAdminDetails(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to dispatch alert.');
    }
  }
);

export const retryNotificationThunk = createAsyncThunk(
  'admin/retryNotificationThunk',
  async ({ token, notifId }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.retryNotification(token, notifId);
      dispatch(fetchAdminDetails(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to retry notification.');
    }
  }
);

export const fetchOrganizationsThunk = createAsyncThunk(
  'admin/fetchOrganizationsThunk',
  async (token, { rejectWithValue }) => {
    try {
      const data = await api.getOrganizations(token);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch organizations.');
    }
  }
);

export const createOrganizationThunk = createAsyncThunk(
  'admin/createOrganizationThunk',
  async ({ token, name, subdomain }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createOrganization(token, name, subdomain);
      dispatch(fetchOrganizationsThunk(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create organization.');
    }
  }
);

const initialState = {
  sysSmsProvider: 'Twilio',
  sysEmailProvider: 'SendGrid',
  sysAllowSelfReg: true,
  sysMaintMode: false,
  notificationLogs: [],
  auditLogs: [],
  organizations: [],
  loading: false
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setSystemConfigState(state, action) {
      const { smsProvider, emailProvider, allowSelfRegistration, maintenanceMode } = action.payload;
      state.sysSmsProvider = smsProvider;
      state.sysEmailProvider = emailProvider;
      state.sysAllowSelfReg = allowSelfRegistration;
      state.sysMaintMode = maintenanceMode;
    },
    setNotificationLogs(state, action) {
      state.notificationLogs = action.payload;
    },
    setAuditLogs(state, action) {
      state.auditLogs = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminDetails.fulfilled, (state, action) => {
        if (action.payload.config) {
          const { smsProvider, emailProvider, allowSelfRegistration, maintenanceMode } = action.payload.config;
          state.sysSmsProvider = smsProvider;
          state.sysEmailProvider = emailProvider;
          state.sysAllowSelfReg = allowSelfRegistration;
          state.sysMaintMode = maintenanceMode;
        }
        state.notificationLogs = action.payload.notifications;
        state.auditLogs = action.payload.audits;
      })
      .addCase(fetchOrganizationsThunk.fulfilled, (state, action) => {
        state.organizations = action.payload;
      });
  }
});

export const { setSystemConfigState, setNotificationLogs, setAuditLogs } = adminSlice.actions;
export default adminSlice.reducer;
