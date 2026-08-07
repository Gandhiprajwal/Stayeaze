import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchBillingPlans = createAsyncThunk(
  'billing/fetchBillingPlans',
  async (token, { rejectWithValue }) => {
    try {
      const data = await api.getBillingPlans(token);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch billing plans.');
    }
  }
);

export const addBillingPlanThunk = createAsyncThunk(
  'billing/addBillingPlanThunk',
  async ({ token, name, baseRent, foodCharges, otherCharges, billingCycle }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createBillingPlan(token, name, baseRent, foodCharges, otherCharges, billingCycle);
      dispatch(fetchBillingPlans(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create plan.');
    }
  }
);

export const addInvoiceThunk = createAsyncThunk(
  'billing/addInvoiceThunk',
  async ({ token, tenantId, dueDate, issueDate, amountDue, items }, { rejectWithValue }) => {
    try {
      const data = await api.createInvoice(token, tenantId, dueDate, issueDate, amountDue, items);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create invoice.');
    }
  }
);

export const addAdjustmentThunk = createAsyncThunk(
  'billing/addAdjustmentThunk',
  async ({ token, tenantId, type, amount, description }, { rejectWithValue }) => {
    try {
      const data = await api.createAdjustment(token, tenantId, type, amount, description);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to apply adjustment.');
    }
  }
);

export const reverseAdjustmentThunk = createAsyncThunk(
  'billing/reverseAdjustmentThunk',
  async ({ token, tenantId, id }, { rejectWithValue }) => {
    try {
      const data = await api.reverseAdjustment(token, tenantId, id);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to reverse adjustment.');
    }
  }
);

export const addMeterReadingThunk = createAsyncThunk(
  'billing/addMeterReadingThunk',
  async ({ token, roomId, readingDate, readingValue, unitRate }, { rejectWithValue }) => {
    try {
      const data = await api.createMeterReading(token, roomId, readingDate, readingValue, unitRate);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to add meter reading.');
    }
  }
);

export const addPaymentThunk = createAsyncThunk(
  'billing/addPaymentThunk',
  async ({ token, tenantId, invoiceId, amount, paymentMethod, transactionReference }, { rejectWithValue }) => {
    try {
      const data = await api.createPayment(token, tenantId, invoiceId, amount, paymentMethod, transactionReference);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to process payment.');
    }
  }
);

export const fetchTenantInvoicesThunk = createAsyncThunk(
  'billing/fetchTenantInvoicesThunk',
  async ({ token, tenantId }, { rejectWithValue }) => {
    try {
      const data = await api.getTenantInvoices(token, tenantId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch tenant invoices.');
    }
  }
);

export const fetchAdjustmentsThunk = createAsyncThunk(
  'billing/fetchAdjustmentsThunk',
  async ({ token, tenantId }, { rejectWithValue }) => {
    try {
      const data = await api.getAdjustments(token, tenantId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch adjustments.');
    }
  }
);

export const fetchMeterReadingsThunk = createAsyncThunk(
  'billing/fetchMeterReadingsThunk',
  async ({ token, roomId }, { rejectWithValue }) => {
    try {
      const data = await api.getMeterReadings(token, roomId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch meter readings.');
    }
  }
);

export const fetchInvoicePaymentsThunk = createAsyncThunk(
  'billing/fetchInvoicePaymentsThunk',
  async ({ token, tenantId, invoiceId }, { rejectWithValue }) => {
    try {
      const data = await api.getInvoicePayments(token, tenantId, invoiceId);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch invoice payments.');
    }
  }
);

const initialState = {
  billingPlans: [],
  tenantInvoices: [],
  tenantAdjustments: [],
  roomMeterReadings: [],
  invoicePayments: [],
  loading: false
};

const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    setBillingPlans(state, action) {
      state.billingPlans = action.payload;
    },
    clearTenantBillingDetails(state) {
      state.tenantInvoices = [];
      state.tenantAdjustments = [];
      state.roomMeterReadings = [];
      state.invoicePayments = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBillingPlans.fulfilled, (state, action) => {
        state.billingPlans = action.payload;
      })
      .addCase(fetchTenantInvoicesThunk.fulfilled, (state, action) => {
        state.tenantInvoices = action.payload;
      })
      .addCase(fetchAdjustmentsThunk.fulfilled, (state, action) => {
        state.tenantAdjustments = action.payload;
      })
      .addCase(fetchMeterReadingsThunk.fulfilled, (state, action) => {
        state.roomMeterReadings = action.payload;
      })
      .addCase(fetchInvoicePaymentsThunk.fulfilled, (state, action) => {
        state.invoicePayments = action.payload;
      });
  }
});

export const { setBillingPlans, clearTenantBillingDetails } = billingSlice.actions;
export default billingSlice.reducer;
