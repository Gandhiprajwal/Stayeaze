import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchMaintenanceComplaints = createAsyncThunk(
  'maintenance/fetchMaintenanceComplaints',
  async ({ token, tenants }, { rejectWithValue }) => {
    try {
      const allTemp = [];
      for (const tenant of tenants) {
        const data = await api.getComplaints(token, tenant.id).catch(() => []);
        data.forEach(c => allTemp.push({ ...c, tenantName: `${tenant.firstName} ${tenant.lastName}` }));
      }
      return allTemp;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch maintenance complaints.');
    }
  }
);

export const addComplaintThunk = createAsyncThunk(
  'maintenance/addComplaintThunk',
  async ({ token, tenants, tenantId, category, description, roomId }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createComplaint(token, tenantId, category, description, roomId);
      dispatch(fetchMaintenanceComplaints({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to file support complaint.');
    }
  }
);

export const updateComplaintStatusThunk = createAsyncThunk(
  'maintenance/updateComplaintStatusThunk',
  async ({ token, tenants, tenantId, compId, status, staff }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.updateComplaintStatus(token, tenantId, compId, status, staff);
      dispatch(fetchMaintenanceComplaints({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to update ticket status.');
    }
  }
);

export const submitFeedbackThunk = createAsyncThunk(
  'maintenance/submitFeedbackThunk',
  async ({ token, tenants, tenantId, compId, feedbackRating, feedbackNotes }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.submitFeedback(token, tenantId, compId, feedbackRating, feedbackNotes);
      dispatch(fetchMaintenanceComplaints({ token, tenants }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save ratings feedback.');
    }
  }
);

const initialState = {
  allComplaints: [],
  loading: false
};

const maintenanceSlice = createSlice({
  name: 'maintenance',
  initialState,
  reducers: {
    setAllComplaints(state, action) {
      state.allComplaints = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMaintenanceComplaints.fulfilled, (state, action) => {
        state.allComplaints = action.payload;
      });
  }
});

export const { setAllComplaints } = maintenanceSlice.actions;
export default maintenanceSlice.reducer;
