import React, { useState, useEffect, useMemo } from 'react';
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
  addBed,
  fetchAllBedsFlat,
  fetchAllRoomsFlat
} from '../store/slices/propertySlice';

export default function RoomPanel({ token, properties, setError, setSuccess }) {
  const dispatch = useDispatch();

  // Active view tab: 'tree', 'table', 'configure'
  const [activeViewTab, setActiveViewTab] = useState('tree');

  // Redux Selectors
  const selectedProperty = useSelector(state => state.property.selectedProperty);
  const buildings = useSelector(state => state.property.buildings);
  const floors = useSelector(state => state.property.floors);
  const rooms = useSelector(state => state.property.rooms);
  const beds = useSelector(state => state.property.beds);
  const allBedsFlat = useSelector(state => state.property.allBedsFlat || []);
  const allRoomsFlat = useSelector(state => state.property.allRoomsFlat || []);

  // Form states
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [bldName, setBldName] = useState('');
  const [bldCode, setBldCode] = useState('');

  const [selectedFloor, setSelectedFloor] = useState(null);
  const [floorNum, setFloorNum] = useState('');
  const [floorNameInput, setFloorNameInput] = useState('');

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomNum, setRoomNum] = useState('');
  const [roomSharing, setRoomSharing] = useState('SINGLE');
  const [roomRent, setRoomRent] = useState('');

  const [bedNum, setBedNum] = useState('');
  const [bedStatus, setBedStatus] = useState('AVAILABLE');
  const [bedQrCode, setBedQrCode] = useState('');

  // Table search & filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Tree expansion state
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Load flat inventory for Master Table & Hierarchy Tree
  useEffect(() => {
    if (token) {
      dispatch(fetchAllBedsFlat(token));
      dispatch(fetchAllRoomsFlat(token));
    }
  }, [token, dispatch]);

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
      setSuccess(`Building "${bldName}" added under ${selectedProperty.name}!`);
      setBldName(''); setBldCode('');
      dispatch(fetchAllBedsFlat(token));
    } catch (err) {
      setError(err || 'Failed to add building.');
    }
  };

  const handleSaveFloor = async (e) => {
    e.preventDefault();
    if (!selectedProperty || !selectedBuilding) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addFloor({
        token,
        propertyId: selectedProperty.id,
        buildingId: selectedBuilding.id,
        floorNumber: parseInt(floorNum),
        name: floorNameInput.trim() || `Floor ${floorNum}`
      })).unwrap();
      setSuccess(`Floor added under ${selectedProperty.name} › ${selectedBuilding.name}!`);
      setFloorNum('');
      setFloorNameInput('');
      dispatch(fetchAllBedsFlat(token));
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
      setSuccess(`Room ${roomNum} configured under ${selectedProperty.name} › ${selectedBuilding.name} › ${selectedFloor.name || 'Floor ' + selectedFloor.floorNumber}!`);
      setRoomNum(''); setRoomRent('');
      dispatch(fetchAllBedsFlat(token));
      dispatch(fetchAllRoomsFlat(token));
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
      setSuccess(`Bed ${bedNum} mapped into Room ${selectedRoom.roomNumber}!`);
      setBedNum(''); setBedQrCode('');
      dispatch(fetchAllBedsFlat(token));
    } catch (err) {
      setError(err || 'Failed to add bed.');
    }
  };

  // Filtered beds for Master Inventory Table
  const filteredBeds = useMemo(() => {
    return allBedsFlat.filter(b => {
      const matchProp = !filterPropertyId || (b.propertyId && b.propertyId === filterPropertyId);
      const matchStatus = filterStatus === 'ALL' || (b.status && b.status.toUpperCase() === filterStatus.toUpperCase());
      
      const q = searchTerm.trim().toLowerCase();
      const matchSearch = !q || (
        (b.bedNumber && b.bedNumber.toLowerCase().includes(q)) ||
        (b.roomNumber && b.roomNumber.toLowerCase().includes(q)) ||
        (b.buildingName && b.buildingName.toLowerCase().includes(q)) ||
        (b.propertyName && b.propertyName.toLowerCase().includes(q)) ||
        (b.tenantName && b.tenantName.toLowerCase().includes(q)) ||
        (b.floorName && b.floorName.toLowerCase().includes(q))
      );

      return matchProp && matchStatus && matchSearch;
    });
  }, [allBedsFlat, filterPropertyId, filterStatus, searchTerm]);

  // Total stats for master table
  const totalBedsCount = allBedsFlat.length;
  const occupiedBedsCount = allBedsFlat.filter(b => (b.status || '').toUpperCase() === 'OCCUPIED').length;
  const availableBedsCount = allBedsFlat.filter(b => (b.status || '').toUpperCase() === 'AVAILABLE').length;
  const occupancyPct = totalBedsCount > 0 ? Math.round((occupiedBedsCount / totalBedsCount) * 100) : 0;

  // Grouped structure for Visual Tree Navigator
  const treeData = useMemo(() => {
    const map = {};
    properties.forEach(p => {
      map[p.id] = { ...p, buildings: {} };
    });

    allBedsFlat.forEach(b => {
      const pId = b.propertyId;
      if (pId && map[pId]) {
        const bId = b.buildingId || 'unknown_bld';
        if (!map[pId].buildings[bId]) {
          map[pId].buildings[bId] = {
            id: bId,
            name: b.buildingName || 'Building',
            floors: {}
          };
        }
        const fId = b.floorId || 'unknown_floor';
        if (!map[pId].buildings[bId].floors[fId]) {
          map[pId].buildings[bId].floors[fId] = {
            id: fId,
            name: b.floorName || (b.floorNumber != null ? `Floor ${b.floorNumber}` : 'Floor'),
            floorNumber: b.floorNumber,
            rooms: {}
          };
        }
        const rId = b.roomId || 'unknown_room';
        if (!map[pId].buildings[bId].floors[fId].rooms[rId]) {
          map[pId].buildings[bId].floors[fId].rooms[rId] = {
            id: rId,
            roomNumber: b.roomNumber || 'Room',
            beds: []
          };
        }
        map[pId].buildings[bId].floors[fId].rooms[rId].beds.push(b);
      }
    });

    return map;
  }, [properties, allBedsFlat]);

  return (
    <>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', textAlign: 'left' }}>Real Estate Asset Hierarchy & Inventory</h1>
        <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'left' }}>
          Real-time visibility connecting Properties › Buildings › Floors › Rooms › Beds.
        </p>
      </header>

      {/* Top Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left' }}>
        <button
          className="btn"
          style={{ flex: 1, fontWeight: 600, background: activeViewTab === 'tree' ? 'var(--primary)' : 'transparent' }}
          onClick={() => setActiveViewTab('tree')}
        >
          Hierarchy Tree Navigator
        </button>
        <button
          className="btn"
          style={{ flex: 1, fontWeight: 600, background: activeViewTab === 'table' ? 'var(--primary)' : 'transparent' }}
          onClick={() => setActiveViewTab('table')}
        >
          Master Inventory Table ({allBedsFlat.length} Beds)
        </button>
        <button
          className="btn"
          style={{ flex: 1, fontWeight: 600, background: activeViewTab === 'configure' ? 'var(--primary)' : 'transparent' }}
          onClick={() => setActiveViewTab('configure')}
        >
          Add & Configure Layout
        </button>
      </div>

      {/* VIEW 1: VISUAL HIERARCHY TREE */}
      {activeViewTab === 'tree' && (
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Property Asset Tree Navigator</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Click any level to expand or collapse its children.
            </span>
          </div>

          {properties.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No properties added yet. Switch to "Add & Configure Layout" to create one.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {properties.map(p => {
                const propNode = treeData[p.id];
                const pKey = `p_${p.id}`;
                const isPropOpen = expandedNodes[pKey] !== false; // Default open
                const bldKeys = Object.keys(propNode?.buildings || {});

                return (
                  <div key={p.id} className="card" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {/* Property Header */}
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => toggleNode(pKey)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isPropOpen ? '▼' : '▶'}</span>
                        <strong style={{ fontSize: '17px' }}>Property: {p.name}</strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({p.address || 'StayEaze'})</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(99,102,241,0.2)', color: 'var(--primary-light, #818cf8)' }}>
                          {bldKeys.length} Building{bldKeys.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    {/* Buildings List */}
                    {isPropOpen && (
                      <div style={{ marginLeft: '24px', marginTop: '14px', borderLeft: '2px dashed rgba(99,102,241,0.3)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {bldKeys.length === 0 ? (
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0' }}>No buildings configured under this property yet.</p>
                        ) : (
                          bldKeys.map(bId => {
                            const bld = propNode.buildings[bId];
                            const bKey = `b_${bId}`;
                            const isBldOpen = expandedNodes[bKey] !== false;
                            const floorKeys = Object.keys(bld.floors || {});

                            return (
                              <div key={bId} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                  onClick={() => toggleNode(bKey)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{isBldOpen ? '▼' : '▶'}</span>
                                    <strong style={{ fontSize: '15px' }}>Building: {bld.name}</strong>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>[in {p.name}]</span>
                                  </div>
                                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)' }}>
                                    {floorKeys.length} Floor Level{floorKeys.length === 1 ? '' : 's'}
                                  </span>
                                </div>

                                {/* Floors List */}
                                {isBldOpen && (
                                  <div style={{ marginLeft: '20px', marginTop: '10px', borderLeft: '2px dashed rgba(168,85,247,0.3)', paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {floorKeys.length === 0 ? (
                                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>No floors configured yet.</p>
                                    ) : (
                                      floorKeys.map(fId => {
                                        const flr = bld.floors[fId];
                                        const fKey = `f_${fId}`;
                                        const isFloorOpen = expandedNodes[fKey] !== false;
                                        const roomKeys = Object.keys(flr.rooms || {});

                                        return (
                                          <div key={fId} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                                            <div
                                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                              onClick={() => toggleNode(fKey)}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{isFloorOpen ? '▼' : '▶'}</span>
                                                <strong style={{ fontSize: '14px' }}>{flr.name}</strong>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                  ({p.name} › {bld.name})
                                                </span>
                                              </div>
                                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                {roomKeys.length} Room{roomKeys.length === 1 ? '' : 's'}
                                              </span>
                                            </div>

                                            {/* Rooms & Beds */}
                                            {isFloorOpen && (
                                              <div style={{ marginLeft: '16px', marginTop: '8px', borderLeft: '2px solid rgba(52,211,153,0.3)', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {roomKeys.length === 0 ? (
                                                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>No rooms configured on this floor.</p>
                                                ) : (
                                                  roomKeys.map(rId => {
                                                    const rm = flr.rooms[rId];
                                                    return (
                                                      <div key={rId} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                          <div>
                                                            <strong>Room {rm.roomNumber}</strong>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                                                              ({p.name} › {bld.name} › {flr.name})
                                                            </span>
                                                          </div>
                                                          <span style={{ fontSize: '11px', color: '#34d399' }}>
                                                            {rm.beds.length} Bed{rm.beds.length === 1 ? '' : 's'}
                                                          </span>
                                                        </div>

                                                        {/* Beds Chips */}
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                          {rm.beds.map(b => (
                                                            <span
                                                              key={b.id}
                                                              style={{
                                                                fontSize: '11px',
                                                                padding: '3px 8px',
                                                                borderRadius: '6px',
                                                                background: b.status === 'AVAILABLE' ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
                                                                color: b.status === 'AVAILABLE' ? '#34d399' : '#fca5a5',
                                                                border: b.status === 'AVAILABLE' ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(239,68,68,0.3)'
                                                              }}
                                                            >
                                                              Bed {b.bedNumber} ({b.status}){b.tenantName ? ` - ${b.tenantName}` : ''}
                                                            </span>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MASTER INVENTORY TABLE */}
      {activeViewTab === 'table' && (
        <div style={{ textAlign: 'left' }}>
          {/* Metrics Summary Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Beds Managed</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{totalBedsCount}</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Occupied Beds</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fca5a5', marginTop: '4px' }}>{occupiedBedsCount}</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Available Vacant Beds</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399', marginTop: '4px' }}>{availableBedsCount}</div>
            </div>
            <div className="card" style={{ padding: '14px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Overall Occupancy</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-light, #818cf8)', marginTop: '4px' }}>{occupancyPct}%</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="card" style={{ padding: '14px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="form-control"
              style={{ flex: 2, minWidth: '220px' }}
              placeholder="Search by Room #, Bed #, Resident Name, Building, Property..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <select
              className="form-control"
              style={{ flex: 1, minWidth: '160px' }}
              value={filterPropertyId}
              onChange={e => setFilterPropertyId(e.target.value)}
            >
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              className="form-control"
              style={{ flex: 1, minWidth: '140px' }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => { setSearchTerm(''); setFilterPropertyId(''); setFilterStatus('ALL'); }}
            >
              Clear Filters
            </button>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 14px' }}>Property</th>
                  <th style={{ padding: '12px 14px' }}>Building</th>
                  <th style={{ padding: '12px 14px' }}>Floor</th>
                  <th style={{ padding: '12px 14px' }}>Room #</th>
                  <th style={{ padding: '12px 14px' }}>Bed #</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Current Resident</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeds.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                      No inventory records match the search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBeds.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{b.propertyName || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{b.buildingName || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{b.floorName || (b.floorNumber != null ? `Floor ${b.floorNumber}` : '—')}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Room {b.roomNumber || '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>Bed {b.bedNumber || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: b.status === 'AVAILABLE' ? 'rgba(52,211,153,0.2)' : b.status === 'OCCUPIED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                          color: b.status === 'AVAILABLE' ? '#34d399' : b.status === 'OCCUPIED' ? '#fca5a5' : '#fbbf24'
                        }}>
                          {b.status || 'AVAILABLE'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {b.tenantName ? (
                          <span style={{ color: 'var(--primary-light, #818cf8)', fontWeight: 500 }}>
                            {b.tenantName}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>Vacant</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: ADD & CONFIGURE INVENTORY */}
      {activeViewTab === 'configure' && (
        <div>
          {/* Active Navigation Breadcrumb */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '8px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            fontSize: '14px',
            textAlign: 'left'
          }}>
            <span style={{ fontWeight: 600, color: 'var(--primary-light, #818cf8)' }}>Selected Path:</span>
            <span style={{ padding: '3px 8px', borderRadius: '4px', background: selectedProperty ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', fontWeight: selectedProperty ? 600 : 400 }}>
              {selectedProperty ? selectedProperty.name : 'No Property Selected'}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>›</span>
            <span style={{ padding: '3px 8px', borderRadius: '4px', background: selectedBuilding ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', fontWeight: selectedBuilding ? 600 : 400 }}>
              {selectedBuilding ? selectedBuilding.name : 'No Building Selected'}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>›</span>
            <span style={{ padding: '3px 8px', borderRadius: '4px', background: selectedFloor ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', fontWeight: selectedFloor ? 600 : 400 }}>
              {selectedFloor ? (selectedFloor.name || `Floor ${selectedFloor.floorNumber}`) : 'No Floor Selected'}
            </span>
            {selectedRoom && (
              <>
                <span style={{ color: 'var(--text-secondary)' }}>›</span>
                <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(52,211,153,0.2)', color: '#34d399', fontWeight: 600 }}>
                  Room {selectedRoom.roomNumber}
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '20px', textAlign: 'left', flexWrap: 'wrap' }}>
            {/* Left Column: Layout Form Builders */}
            <div style={{ flex: 1, minWidth: '340px' }} className="card">
              <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                Configure Hierarchy
              </h3>
              
              {/* Property Selector */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>1. Choose Property</label>
                <select
                  className="form-control"
                  value={selectedProperty?.id || ''}
                  onChange={e => dispatch(setSelectedProperty(properties.find(p => p.id === e.target.value)))}
                >
                  <option value="">-- Choose Property --</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.address || 'StayEaze'})</option>)}
                </select>
              </div>

              {/* Building Form */}
              {selectedProperty && (
                <div className="form-group" style={{ marginTop: '14px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Add Building in <span style={{ color: 'var(--primary-light, #818cf8)' }}>{selectedProperty.name}</span></label>
                  <form onSubmit={handleSaveBuilding} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <input className="form-control" style={{ flex: 1.5, minWidth: '120px' }} placeholder="Building Name (e.g. Block A)" required value={bldName} onChange={e => setBldName(e.target.value)} />
                    <input className="form-control" style={{ flex: 1, minWidth: '80px' }} placeholder="Code (e.g. BLK-A)" required value={bldCode} onChange={e => setBldCode(e.target.value)} />
                    <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px' }}>+ Add Building</button>
                  </form>
                </div>
              )}

              {/* Building Selector */}
              {buildings.length > 0 && (
                <div className="form-group" style={{ marginTop: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>2. Choose Building (in {selectedProperty?.name})</label>
                  <select
                    className="form-control"
                    value={selectedBuilding?.id || ''}
                    onChange={e => setSelectedBuilding(buildings.find(b => b.id === e.target.value))}
                  >
                    <option value="">-- Choose Building --</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name} [{b.code || 'B'}]</option>)}
                  </select>
                </div>
              )}

              {/* Floor Form */}
              {selectedBuilding && (
                <div className="form-group" style={{ marginTop: '14px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Add Floor Level in <span style={{ color: 'var(--primary-light, #818cf8)' }}>{selectedProperty?.name} › {selectedBuilding.name}</span>
                  </label>
                  <form onSubmit={handleSaveFloor} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <input className="form-control" style={{ flex: 1, minWidth: '90px' }} type="number" placeholder="Level #" required value={floorNum} onChange={e => setFloorNum(e.target.value)} />
                    <input className="form-control" style={{ flex: 1.5, minWidth: '130px' }} placeholder="Floor Name (e.g. 1st Floor)" value={floorNameInput} onChange={e => setFloorNameInput(e.target.value)} />
                    <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px' }}>+ Add Floor</button>
                  </form>
                </div>
              )}

              {/* Floor Selector */}
              {floors.length > 0 && (
                <div className="form-group" style={{ marginTop: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>3. Choose Floor Level (in {selectedBuilding?.name})</label>
                  <select
                    className="form-control"
                    value={selectedFloor?.id || ''}
                    onChange={e => setSelectedFloor(floors.find(f => f.id === e.target.value))}
                  >
                    <option value="">-- Choose Floor --</option>
                    {floors.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name || `Floor ${f.floorNumber}`} (Level {f.floorNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Room Form */}
              {selectedFloor && (
                <div style={{ marginTop: '18px', padding: '14px', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>
                    4. Add Room to <span style={{ color: 'var(--primary-light, #818cf8)' }}>{selectedProperty?.name} › {selectedBuilding?.name} › {selectedFloor.name || `Floor ${selectedFloor.floorNumber}`}</span>
                  </h4>
                  <form onSubmit={handleSaveRoom} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input className="form-control" style={{ flex: 1 }} placeholder="Room Number (e.g. 101)" required value={roomNum} onChange={e => setRoomNum(e.target.value)} />
                      <select className="form-control" style={{ flex: 1 }} value={roomSharing} onChange={e => setRoomSharing(e.target.value)}>
                        <option value="SINGLE">Single (1 Bed)</option>
                        <option value="DOUBLE">Double (2 Beds)</option>
                        <option value="TRIPLE">Triple (3 Beds)</option>
                        <option value="FOUR_SHARING">Four Sharing (4 Beds)</option>
                      </select>
                    </div>
                    <input className="form-control" type="number" step="any" placeholder="Base Monthly Rent (INR)" required value={roomRent} onChange={e => setRoomRent(e.target.value)} />
                    <button type="submit" className="btn btn-primary">+ Add Room to Floor</button>
                  </form>
                </div>
              )}
            </div>

            {/* Right Column: Rooms & Beds Explorer */}
            <div style={{ flex: 1.5, minWidth: '380px' }} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Floor Inventory Explorer</h3>
                {rooms.length > 0 && (
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '12px' }}>
                    {rooms.length} Room{rooms.length > 1 ? 's' : ''} on this Floor
                  </span>
                )}
              </div>

              {!selectedFloor ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>Please select a Property, Building, and Floor on the left to inspect its rooms and beds.</p>
                </div>
              ) : rooms.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px' }}>
                  No rooms configured for {selectedProperty?.name} › {selectedBuilding?.name} › {selectedFloor?.name || `Floor ${selectedFloor?.floorNumber}`}. Add one on the left!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  {rooms.map(r => (
                    <div
                      key={r.id}
                      style={{
                        border: selectedRoom?.id === r.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                        background: selectedRoom?.id === r.id ? 'rgba(99,102,241,0.08)' : 'var(--bg-input)',
                        borderRadius: '8px',
                        padding: '14px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                        onClick={() => setSelectedRoom(selectedRoom?.id === r.id ? null : r)}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '16px' }}>Room {r.roomNumber}</strong>
                            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(99,102,241,0.2)', color: 'var(--primary-light, #818cf8)' }}>
                              {r.sharingType}
                            </span>
                            <span style={{
                              fontSize: '12px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: (r.occupied || 0) >= (r.beds || 1) ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)',
                              color: (r.occupied || 0) >= (r.beds || 1) ? '#fca5a5' : '#34d399'
                            }}>
                              {r.occupied || 0} / {r.beds || 0} Beds Occupied
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span>{r.propertyName || selectedProperty?.name}</span>
                            <span>•</span>
                            <span>{r.buildingName || selectedBuilding?.name}</span>
                            <span>•</span>
                            <span>{r.floorName || (r.floorNumber != null ? `Floor ${r.floorNumber}` : selectedFloor?.name || `Floor ${selectedFloor?.floorNumber}`)}</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, color: '#34d399' }}>
                            {selectedProperty?.currency || 'INR'} {r.baseRent || r.rent || 0}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>per month</span>
                        </div>
                      </div>

                      {/* Bed Configuration Accordion */}
                      {selectedRoom?.id === r.id && (
                        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--primary-light, #818cf8)' }}>
                            Beds inside Room {r.roomNumber} ({selectedProperty?.name} › {selectedBuilding?.name})
                          </h5>
                          <form onSubmit={handleSaveBed} style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <input className="form-control" style={{ flex: 1.5, minWidth: '110px' }} placeholder="Bed Identifier (e.g. B1)" required value={bedNum} onChange={e => setBedNum(e.target.value)} />
                            <select className="form-control" style={{ flex: 1, minWidth: '110px' }} value={bedStatus} onChange={e => setBedStatus(e.target.value)}>
                              <option value="AVAILABLE">Available</option>
                              <option value="OCCUPIED">Occupied</option>
                              <option value="MAINTENANCE">Maintenance</option>
                            </select>
                            <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px' }}>+ Add Bed</button>
                          </form>

                          {beds.length === 0 ? (
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0' }}>No beds added for this room yet.</p>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                              {beds.map(b => (
                                <div
                                  key={b.id}
                                  style={{
                                    padding: '8px 10px',
                                    background: 'rgba(0,0,0,0.25)',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>Bed {b.bedNumber}</strong>
                                    <span style={{
                                      fontSize: '11px',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      background: b.status === 'AVAILABLE' ? 'rgba(52,211,153,0.2)' : b.status === 'OCCUPIED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                                      color: b.status === 'AVAILABLE' ? '#34d399' : b.status === 'OCCUPIED' ? '#fca5a5' : '#fbbf24'
                                    }}>
                                      {b.status}
                                    </span>
                                  </div>
                                  {b.tenantName && (
                                    <span style={{ fontSize: '11px', color: '#818cf8' }}>
                                      Tenant: {b.tenantName}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                    {b.propertyName || selectedProperty?.name} › {b.buildingName || selectedBuilding?.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
