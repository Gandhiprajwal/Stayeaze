import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setSelectedProperty,
  fetchBuildings,
  addBuilding,
  fetchFloors,
  addFloor,
  fetchRooms,
  addRoom,
  fetchBeds,
  addBed
} from '../store/slices/propertySlice';

export default function RoomPanel({ token, properties, setError, setSuccess }) {
  const dispatch = useDispatch();

  // Redux Selectors
  const selectedProperty = useSelector(state => state.property.selectedProperty);
  const buildings = useSelector(state => state.property.buildings);
  const floors = useSelector(state => state.property.floors);
  const rooms = useSelector(state => state.property.rooms);
  const beds = useSelector(state => state.property.beds);

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [bldName, setBldName] = useState('');
  const [bldCode, setBldCode] = useState('');

  const [selectedFloor, setSelectedFloor] = useState(null);
  const [floorNum, setFloorNum] = useState('');

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomNum, setRoomNum] = useState('');
  const [roomSharing, setRoomSharing] = useState('SINGLE');
  const [roomRent, setRoomRent] = useState('');

  const [bedNum, setBedNum] = useState('');
  const [bedStatus, setBedStatus] = useState('AVAILABLE');
  const [bedQrCode, setBedQrCode] = useState('');

  useEffect(() => {
    if (selectedProperty) {
      dispatch(fetchBuildings({ token, propertyId: selectedProperty.id }));
      setSelectedBuilding(null);
      setSelectedFloor(null);
      setSelectedRoom(null);
    }
  }, [selectedProperty]);

  useEffect(() => {
    if (selectedProperty && selectedBuilding) {
      dispatch(fetchFloors({ token, propertyId: selectedProperty.id, buildingId: selectedBuilding.id }));
      setSelectedFloor(null);
      setSelectedRoom(null);
    }
  }, [selectedBuilding]);

  useEffect(() => {
    if (selectedProperty && selectedBuilding && selectedFloor) {
      dispatch(fetchRooms({ token, propertyId: selectedProperty.id, buildingId: selectedBuilding.id, floorId: selectedFloor.id }));
      setSelectedRoom(null);
    }
  }, [selectedFloor]);

  useEffect(() => {
    if (selectedRoom) {
      dispatch(fetchBeds({ token, roomId: selectedRoom.id }));
    }
  }, [selectedRoom]);

  const handleSaveBuilding = async (e) => {
    e.preventDefault();
    if (!selectedProperty) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addBuilding({ token, propertyId: selectedProperty.id, name: bldName, code: bldCode })).unwrap();
      setSuccess('Building config added successfully!');
      setBldName(''); setBldCode('');
    } catch (err) {
      setError(err || 'Failed to add building.');
    }
  };

  const handleSaveFloor = async (e) => {
    e.preventDefault();
    if (!selectedProperty || !selectedBuilding) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addFloor({ token, propertyId: selectedProperty.id, buildingId: selectedBuilding.id, floorNumber: parseInt(floorNum) })).unwrap();
      setSuccess('Floor level added!');
      setFloorNum('');
    } catch (err) {
      setError(err || 'Failed to add floor.');
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    if (!selectedProperty || !selectedBuilding || !selectedFloor) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addRoom({
        token,
        propertyId: selectedProperty.id,
        buildingId: selectedBuilding.id,
        floorId: selectedFloor.id,
        roomNumber: roomNum,
        sharingType: roomSharing,
        baseRent: parseFloat(roomRent)
      })).unwrap();
      setSuccess('Room inventory configured!');
      setRoomNum(''); setRoomRent('');
    } catch (err) {
      setError(err || 'Failed to add room.');
    }
  };

  const handleSaveBed = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addBed({
        token,
        roomId: selectedRoom.id,
        bedNumber: bedNum,
        status: bedStatus,
        qrCode: bedQrCode || `QR-${bedNum}`
      })).unwrap();
      setSuccess('Bed inventory mapped!');
      setBedNum(''); setBedQrCode('');
    } catch (err) {
      setError(err || 'Failed to add bed.');
    }
  };

  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>Rooms & Beds Configuration</h1>
      </header>

      <div style={{ display: 'flex', gap: '20px', textAlign: 'left', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }} className="card">
          <h3>Create Inventory Layout</h3>
          
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Property</label>
            <select
              className="form-control"
              value={selectedProperty?.id || ''}
              onChange={e => dispatch(setSelectedProperty(properties.find(p => p.id === e.target.value)))}
            >
              <option value="">-- Choose Property --</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {selectedProperty && (
            <div className="form-group" style={{ marginTop: '10px' }}>
              <label className="form-label">Create Building</label>
              <form onSubmit={handleSaveBuilding} style={{ display: 'flex', gap: '10px' }}>
                <input className="form-control" placeholder="Name" required value={bldName} onChange={e => setBldName(e.target.value)} />
                <input className="form-control" placeholder="Code" required value={bldCode} onChange={e => setBldCode(e.target.value)} />
                <button type="submit" className="btn btn-primary">Add</button>
              </form>
            </div>
          )}

          {buildings.length > 0 && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Building</label>
              <select
                className="form-control"
                value={selectedBuilding?.id || ''}
                onChange={e => setSelectedBuilding(buildings.find(b => b.id === e.target.value))}
              >
                <option value="">-- Choose Building --</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {selectedBuilding && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Add Floor level</label>
              <form onSubmit={handleSaveFloor} style={{ display: 'flex', gap: '10px' }}>
                <input className="form-control" type="number" placeholder="Floor level" required value={floorNum} onChange={e => setFloorNum(e.target.value)} />
                <button type="submit" className="btn btn-primary">Add Floor</button>
              </form>
            </div>
          )}

          {floors.length > 0 && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Floor level</label>
              <select
                className="form-control"
                value={selectedFloor?.id || ''}
                onChange={e => setSelectedFloor(floors.find(f => f.id === e.target.value))}
              >
                <option value="">-- Choose Floor --</option>
                {floors.map(f => <option key={f.id} value={f.id}>{f.floorNumber}</option>)}
              </select>
            </div>
          )}

          {selectedFloor && (
            <form onSubmit={handleSaveRoom} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4>Add Room on Level {selectedFloor.floorNumber}</h4>
              <input className="form-control" placeholder="Room Number" required value={roomNum} onChange={e => setRoomNum(e.target.value)} />
              <select className="form-control" value={roomSharing} onChange={e => setRoomSharing(e.target.value)}>
                <option value="SINGLE">Single Sharing</option>
                <option value="DOUBLE">Double Sharing</option>
                <option value="TRIPLE">Triple Sharing</option>
              </select>
              <input className="form-control" type="number" placeholder="Rent Amount" required value={roomRent} onChange={e => setRoomRent(e.target.value)} />
              <button type="submit" className="btn btn-primary">Add Room</button>
            </form>
          )}
        </div>

        <div style={{ flex: 1.5, minWidth: '350px' }} className="card">
          <h3>Rooms & Beds Inventory</h3>
          {rooms.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No rooms configured for selected layout.</p> : (
            rooms.map(r => (
              <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSelectedRoom(selectedRoom?.id === r.id ? null : r)}>
                  <strong>Room {r.roomNumber} ({r.sharingType})</strong>
                  <span>Rent: {selectedProperty?.currency || 'INR'} {r.baseRent}</span>
                </div>
                {selectedRoom?.id === r.id && (
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', marginTop: '8px', borderRadius: '4px' }}>
                    <form onSubmit={handleSaveBed} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input className="form-control" placeholder="Bed identifier" required value={bedNum} onChange={e => setBedNum(e.target.value)} />
                      <button type="submit" className="btn btn-primary">Add Bed</button>
                    </form>
                    {beds.map(b => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                        <span>🛏️ Bed {b.bedNumber}</span>
                        <span style={{ color: b.status === 'AVAILABLE' ? '#34d399' : '#fca5a5' }}>({b.status})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
