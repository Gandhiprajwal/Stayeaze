import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchTenants = createAsyncThunk(
  'tenant/fetchTenants',
  async (token, { rejectWithValue }) => {
    try {
      const data = await api.getTenants(token);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch tenants.');
    }
  }
);

export const fetchInquiries = createAsyncThunk(
  'tenant/fetchInquiries',
  async (token, { rejectWithValue }) => {
    try {
      const data = await api.getInquiries(token);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch inquiries.');
    }
  }
);

export const addTenant = createAsyncThunk(
  'tenant/addTenant',
  async ({ token, firstName, lastName, mobile }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createTenant(token, firstName, lastName, mobile);
      dispatch(fetchTenants(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to register tenant.');
    }
  }
);

export const addBooking = createAsyncThunk(
  'tenant/addBooking',
  async ({ token, tenantId, bedId, checkinDate, rentAgreed, depositAgreed }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createBooking(token, tenantId, bedId, checkinDate, rentAgreed, depositAgreed);
      dispatch(fetchTenants(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create room checkin.');
    }
  }
);

export const addDocument = createAsyncThunk(
  'tenant/addDocument',
  async ({ token, tenantId, documentType, documentNumber, fileUrl }, { rejectWithValue }) => {
    try {
      const data = await api.createDocument(token, tenantId, documentType, documentNumber, fileUrl);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to upload document.');
    }
  }
);

export const verifyDocumentThunk = createAsyncThunk(
  'tenant/verifyDocumentThunk',
  async ({ token, tenantId, docId, status }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.verifyDocument(token, tenantId, docId, status);
      dispatch(fetchTenants(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to verify document.');
    }
  }
);

export const addAgreement = createAsyncThunk(
  'tenant/addAgreement',
  async ({ token, tenantId, terms, startDate, endDate }, { rejectWithValue }) => {
    try {
      const data = await api.createAgreement(token, tenantId, terms, startDate, endDate);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to draft agreement.');
    }
  }
);

export const signAgreementThunk = createAsyncThunk(
  'tenant/signAgreementThunk',
  async ({ token, tenantId, agreementId, signatureUrl }, { rejectWithValue }) => {
    try {
      const data = await api.signAgreement(token, tenantId, agreementId, signatureUrl);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to e-sign agreement.');
    }
  }
);

export const addCheckinChecklist = createAsyncThunk(
  'tenant/addCheckinChecklist',
  async ({ token, bookingId, keysHandedOver, amenitiesHandedOver, subMeterReading, notes }, { rejectWithValue }) => {
    try {
      const data = await api.createCheckinChecklist(token, bookingId, keysHandedOver, amenitiesHandedOver, subMeterReading, notes);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save checkin checklist.');
    }
  }
);

export const addCheckoutAudit = createAsyncThunk(
  'tenant/addCheckoutAudit',
  async ({ token, bookingId, damagesChecked, damageCharges, keysReturned, refundAmount, notes }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createCheckoutAudit(token, bookingId, damagesChecked, damageCharges, keysReturned, refundAmount, notes);
      dispatch(fetchTenants(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save checkout audit.');
    }
  }
);

export const addInquiry = createAsyncThunk(
  'tenant/addInquiry',
  async ({ token, guestName, email, mobile }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createInquiry(token, guestName, email, mobile);
      dispatch(fetchInquiries(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to save inquiry lead.');
    }
  }
);

export const fetchBookingsThunk = createAsyncThunk(
  'tenant/fetchBookingsThunk',
  async ({ token, tenantId }, { rejectWithValue }) => {
    try {
      const data = await api.getBookings(token, tenantId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch bookings.');
    }
  }
);

export const fetchDocumentsThunk = createAsyncThunk(
  'tenant/fetchDocumentsThunk',
  async ({ token, tenantId }, { rejectWithValue }) => {
    try {
      const data = await api.getDocuments(token, tenantId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch documents.');
    }
  }
);

export const fetchAgreementsThunk = createAsyncThunk(
  'tenant/fetchAgreementsThunk',
  async ({ token, tenantId }, { rejectWithValue }) => {
    try {
      const data = await api.getAgreements(token, tenantId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch agreements.');
    }
  }
);

export const fetchCheckinChecklistThunk = createAsyncThunk(
  'tenant/fetchCheckinChecklistThunk',
  async ({ token, bookingId }, { rejectWithValue }) => {
    try {
      const data = await api.getCheckinChecklist(token, bookingId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch checklist.');
    }
  }
);

export const fetchCheckoutAuditThunk = createAsyncThunk(
  'tenant/fetchCheckoutAuditThunk',
  async ({ token, bookingId }, { rejectWithValue }) => {
    try {
      const data = await api.getCheckoutAudit(token, bookingId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch checkout audit.');
    }
  }
);

export const convertInquiryThunk = createAsyncThunk(
  'tenant/convertInquiryThunk',
  async ({ token, inquiryId }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.convertInquiry(token, inquiryId);
      dispatch(fetchInquiries(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to convert lead.');
    }
  }
);

const initialState = {
  tenants: [],
  inquiries: [],
  selectedTenant: null,
  selectedTenantBookings: [],
  selectedTenantDocs: [],
  selectedTenantAgreements: [],
  selectedTenantCheckin: null,
  selectedTenantCheckout: null,
  loading: false
};

const tenantSlice = createSlice({
  name: 'tenant',
  initialState,
  reducers: {
    setTenants(state, action) {
      state.tenants = action.payload;
    },
    setInquiries(state, action) {
      state.inquiries = action.payload;
    },
    setSelectedTenant(state, action) {
      state.selectedTenant = action.payload;
      state.selectedTenantBookings = [];
      state.selectedTenantDocs = [];
      state.selectedTenantAgreements = [];
      state.selectedTenantCheckin = null;
      state.selectedTenantCheckout = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenants.fulfilled, (state, action) => {
        state.tenants = action.payload;
      })
      .addCase(fetchInquiries.fulfilled, (state, action) => {
        state.inquiries = action.payload;
      })
      .addCase(fetchBookingsThunk.fulfilled, (state, action) => {
        state.selectedTenantBookings = action.payload;
      })
      .addCase(fetchDocumentsThunk.fulfilled, (state, action) => {
        state.selectedTenantDocs = action.payload;
      })
      .addCase(fetchAgreementsThunk.fulfilled, (state, action) => {
        state.selectedTenantAgreements = action.payload;
      })
      .addCase(fetchCheckinChecklistThunk.fulfilled, (state, action) => {
        state.selectedTenantCheckin = action.payload;
      })
      .addCase(fetchCheckinChecklistThunk.rejected, (state) => {
        state.selectedTenantCheckin = null;
      })
      .addCase(fetchCheckoutAuditThunk.fulfilled, (state, action) => {
        state.selectedTenantCheckout = action.payload;
      })
      .addCase(fetchCheckoutAuditThunk.rejected, (state) => {
        state.selectedTenantCheckout = null;
      });
  }
});

export const { setTenants, setInquiries, setSelectedTenant } = tenantSlice.actions;
export default tenantSlice.reducer;
