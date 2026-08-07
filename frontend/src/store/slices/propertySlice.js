import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../services/api';

export const fetchProperties = createAsyncThunk(
  'property/fetchProperties',
  async (token, { rejectWithValue }) => {
    try {
      const data = await api.getProperties(token);
      return data.filter(p => p.status !== 'ARCHIVED');
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch properties.');
    }
  }
);

export const addProperty = createAsyncThunk(
  'property/addProperty',
  async ({ token, name, address }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createProperty(token, name, address);
      dispatch(fetchProperties(token));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to add property.');
    }
  }
);

export const fetchBuildings = createAsyncThunk(
  'property/fetchBuildings',
  async ({ token, propertyId }, { rejectWithValue }) => {
    try {
      const data = await api.getBuildings(token, propertyId);
      return data.filter(b => b.status !== 'ARCHIVED');
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch buildings.');
    }
  }
);

export const addBuilding = createAsyncThunk(
  'property/addBuilding',
  async ({ token, propertyId, name, code }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createBuilding(token, propertyId, name, code);
      dispatch(fetchBuildings({ token, propertyId }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to add building.');
    }
  }
);

// Floors
export const fetchFloors = createAsyncThunk(
  'property/fetchFloors',
  async ({ token, propertyId, buildingId }, { rejectWithValue }) => {
    try {
      const data = await api.getFloors(token, propertyId, buildingId);
      return data.filter(f => f.status !== 'ARCHIVED');
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch floors.');
    }
  }
);

export const addFloor = createAsyncThunk(
  'property/addFloor',
  async ({ token, propertyId, buildingId, floorNumber }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createFloor(token, propertyId, buildingId, floorNumber);
      dispatch(fetchFloors({ token, propertyId, buildingId }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to add floor.');
    }
  }
);

// Rooms
export const fetchRooms = createAsyncThunk(
  'property/fetchRooms',
  async ({ token, propertyId, buildingId, floorId }, { rejectWithValue }) => {
    try {
      const data = await api.getRooms(token, propertyId, buildingId, floorId);
      return data.filter(r => r.status !== 'ARCHIVED');
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch rooms.');
    }
  }
);

export const addRoom = createAsyncThunk(
  'property/addRoom',
  async ({ token, propertyId, buildingId, floorId, roomNumber, sharingType, baseRent }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createRoom(token, propertyId, buildingId, floorId, roomNumber, sharingType, baseRent);
      dispatch(fetchRooms({ token, propertyId, buildingId, floorId }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to add room.');
    }
  }
);

// Beds
export const fetchBeds = createAsyncThunk(
  'property/fetchBeds',
  async ({ token, roomId }, { rejectWithValue }) => {
    try {
      const data = await api.getBeds(token, roomId);
      return data.filter(b => b.status !== 'ARCHIVED');
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch beds.');
    }
  }
);

export const addBed = createAsyncThunk(
  'property/addBed',
  async ({ token, roomId, bedNumber, status, qrCode }, { dispatch, rejectWithValue }) => {
    try {
      const data = await api.createBed(token, roomId, bedNumber, status, qrCode);
      dispatch(fetchBeds({ token, roomId }));
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to add bed.');
    }
  }
);

const initialState = {
  properties: [],
  selectedProperty: null,
  buildings: [],
  floors: [],
  rooms: [],
  beds: [],
  loading: false
};

const propertySlice = createSlice({
  name: 'property',
  initialState,
  reducers: {
    setProperties(state, action) {
      state.properties = action.payload;
    },
    setSelectedProperty(state, action) {
      state.selectedProperty = action.payload;
    },
    setBuildings(state, action) {
      state.buildings = action.payload;
    },
    setFloors(state, action) {
      state.floors = action.payload;
    },
    setRooms(state, action) {
      state.rooms = action.payload;
    },
    setBeds(state, action) {
      state.beds = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProperties.fulfilled, (state, action) => {
        state.properties = action.payload;
      })
      .addCase(fetchBuildings.fulfilled, (state, action) => {
        state.buildings = action.payload;
      })
      .addCase(fetchFloors.fulfilled, (state, action) => {
        state.floors = action.payload;
      })
      .addCase(fetchRooms.fulfilled, (state, action) => {
        state.rooms = action.payload;
      })
      .addCase(fetchBeds.fulfilled, (state, action) => {
        state.beds = action.payload;
      });
  }
});

export const { setProperties, setSelectedProperty, setBuildings, setFloors, setRooms, setBeds } = propertySlice.actions;
export default propertySlice.reducer;
