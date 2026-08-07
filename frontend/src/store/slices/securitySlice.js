import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchSecurityInformation = createAsyncThunk(
  'security/fetchSecurityInformation',
  async ({ token, tenants }, { rejectWithValue }) => {
    try {
      const tempVis = [];
      for (const tenant of tenants) {
        const vis = await api.getVisitors(token, tenant.id).catch(() => []);
        vis.forEach(v => tempVis.push({ ...v, tenantName: `${tenant.firstName} ${tenant.lastName}` }));
      }

      const tempPar = [];
      for (const tenant of tenants) {
        const par = await api.getParcels(token, tenant.id).catch(() => []);
        par.forEach(p => tempPar.push({ ...p, tenantName: `${tenant.firstName} ${tenant.lastName}` }));
      }

      const incs = await api.getIncidents(token).catch(() => []);

      return { visitors: tempVis, parcels: tempPar, incidents: incs };
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch security information.');
    }
  }
);

export const addVisitorThunk = createAsyncThunk(
  'security/addVisitorThunk',
  async ({ token, tenants, tenantId, visitorName, mobileNumber, purpose }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createVisitor(token, tenantId, visitorName, mobileNumber, purpose);
      dispatch(fetchSecurityInformation({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to pre-register visitor.');
    }
  }
);

export const updateVisitorStatusThunk = createAsyncThunk(
  'security/updateVisitorStatusThunk',
  async ({ token, tenants, tenantId, id, checkpoint }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.updateVisitorStatus(token, tenantId, id, checkpoint);
      dispatch(fetchSecurityInformation({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to check-in/out visitor.');
    }
  }
);

export const addParcelThunk = createAsyncThunk(
  'security/addParcelThunk',
  async ({ token, tenants, tenantId, courierCompany, trackingNumber }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createParcel(token, tenantId, courierCompany, trackingNumber);
      dispatch(fetchSecurityInformation({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to record parcel delivery.');
    }
  }
);

export const handoverParcelThunk = createAsyncThunk(
  'security/handoverParcelThunk',
  async ({ token, tenants, tenantId, id, signature }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.handoverParcel(token, tenantId, id, signature);
      dispatch(fetchSecurityInformation({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to handover parcel.');
    }
  }
);

export const addIncidentThunk = createAsyncThunk(
  'security/addIncidentThunk',
  async ({ token, tenants, reportedBy, description, severity }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createIncident(token, reportedBy, description, severity);
      dispatch(fetchSecurityInformation({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to log safety alert.');
    }
  }
);

export const updateIncidentStatusThunk = createAsyncThunk(
  'security/updateIncidentStatusThunk',
  async ({ token, tenants, id, status }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.updateIncidentStatus(token, id, status);
      dispatch(fetchSecurityInformation({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to update incident severity.');
    }
  }
);

const initialState = {
  allVisitors: [],
  allParcels: [],
  allIncidents: [],
  loading: false
};

const securitySlice = createSlice({
  name: 'security',
  initialState,
  reducers: {
    setAllVisitors(state, action) {
      state.allVisitors = action.payload;
    },
    setAllParcels(state, action) {
      state.allParcels = action.payload;
    },
    setAllIncidents(state, action) {
      state.allIncidents = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSecurityInformation.fulfilled, (state, action) => {
        state.allVisitors = action.payload.visitors;
        state.allParcels = action.payload.parcels;
        state.allIncidents = action.payload.incidents;
      });
  }
});

export const { setAllVisitors, setAllParcels, setAllIncidents } = securitySlice.actions;
export default securitySlice.reducer;
