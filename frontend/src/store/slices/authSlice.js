import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await api.login(email, password);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Login failed.');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ orgName, ownerName, email, mobile, password }, { rejectWithValue }) => {
    try {
      const data = await api.register(orgName, ownerName, email, mobile, password);
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Registration failed.');
    }
  }
);

const savedUser = localStorage.getItem('se_user');
const initialState = {
  user: savedUser ? JSON.parse(savedUser) : null,
  view: savedUser ? 'dashboard' : 'login', // 'login', 'register', 'dashboard'
  activeTab: 'home',
  errorMsg: '',
  successMsg: '',
  loading: false
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      if (action.payload) {
        localStorage.setItem('se_user', JSON.stringify(action.payload));
      } else {
        localStorage.removeItem('se_user');
      }
    },
    setView(state, action) {
      state.view = action.payload;
    },
    setActiveTab(state, action) {
      state.activeTab = action.payload;
    },
    setErrorMsg(state, action) {
      state.errorMsg = action.payload;
    },
    setSuccessMsg(state, action) {
      state.successMsg = action.payload;
    },
    clearMessages(state) {
      state.errorMsg = '';
      state.successMsg = '';
    },
    logout(state) {
      state.user = null;
      state.view = 'login';
      state.activeTab = 'home';
      state.errorMsg = '';
      state.successMsg = '';
      localStorage.removeItem('se_user');
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.errorMsg = '';
        state.successMsg = '';
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.view = 'dashboard';
        state.activeTab = 'home';
        state.successMsg = 'Welcome back to StayEaze!';
        localStorage.setItem('se_user', JSON.stringify(action.payload));
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.errorMsg = action.payload;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.errorMsg = '';
        state.successMsg = '';
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
        state.successMsg = 'Registration successful! Please log in.';
        state.view = 'login';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.errorMsg = action.payload;
      });
  }
});

export const {
  setUser,
  setView,
  setActiveTab,
  setErrorMsg,
  setSuccessMsg,
  clearMessages,
  logout
} = authSlice.actions;

export default authSlice.reducer;
