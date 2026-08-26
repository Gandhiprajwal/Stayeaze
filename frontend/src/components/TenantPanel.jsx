import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addTenant,
  addBooking,
  addDocument,
  verifyDocumentThunk,
  addAgreement,
  signAgreementThunk,
  addCheckinChecklist,
  addCheckoutAudit,
  addInquiry,
  convertInquiryThunk,
  setSelectedTenant,
  fetchBookingsThunk,
  fetchDocumentsThunk,
  fetchAgreementsThunk,
  fetchCheckinChecklistThunk,
  fetchCheckoutAuditThunk
} from '../store/slices/tenantSlice';
import { fetchAllBedsFlat } from '../store/slices/propertySlice';

export default function TenantPanel({ token, tenants, fetchTenants, inquiries, fetchInquiries, setError, setSuccess }) {
  const dispatch = useDispatch();
  const selectedTenant = useSelector(state => state.tenant.selectedTenant);
  const bookings = useSelector(state => state.tenant.selectedTenantBookings);
  const tenantDocs = useSelector(state => state.tenant.selectedTenantDocs);
  const tenantAgreements = useSelector(state => state.tenant.selectedTenantAgreements);
  const activeCheckinChecklist = useSelector(state => state.tenant.selectedTenantCheckin);
  const activeCheckoutAudit = useSelector(state => state.tenant.selectedTenantCheckout);
  const allBedsFlat = useSelector(state => state.property.allBedsFlat || []);

  useEffect(() => {
    if (token) {
      dispatch(fetchAllBedsFlat(token));
    }
  }, [token, dispatch]);

  const [tenantSubTab, setTenantSubTab] = useState('residents'); // 'residents', 'leads'
  const [residentViewTab, setResidentViewTab] = useState('details'); // 'details', 'kyc', 'agreements', 'checkin-checklist', 'checkout-audit'

  // Forms
  const [tFirstName, setTFirstName] = useState('');
  const [tLastName, setTLastName] = useState('');
  const [tMobile, setTMobile] = useState('');

  const [bookingBedId, setBookingBedId] = useState('');
  const [bookingCheckinDate, setBookingCheckinDate] = useState('');
  const [bookingRentAgreed, setBookingRentAgreed] = useState('');
  const [bookingDepositAgreed, setBookingDepositAgreed] = useState('');

  const [docType, setDocType] = useState('AADHAAR');
  const [docNumber, setDocNumber] = useState('');

  const [agrTerms, setAgrTerms] = useState('');
  const [agrStartDate, setAgrStartDate] = useState('');
  const [agrEndDate, setAgrEndDate] = useState('');
  const [signatureText, setSignatureText] = useState('');

  const [chkKeysHanded, setChkKeysHanded] = useState(false);
  const [chkAmenitiesHanded, setChkAmenitiesHanded] = useState(false);
  const [chkSubmeterVal, setChkSubmeterVal] = useState('');
  const [chkNotes, setChkNotes] = useState('');

  const [outDamagesChecked, setOutDamagesChecked] = useState(false);
  const [outDamageCharges, setOutDamageCharges] = useState('');
  const [outKeysReturned, setOutKeysReturned] = useState(false);
  const [outRefundAmt, setOutRefundAmt] = useState('');
  const [outNotes, setOutNotes] = useState('');

  const [inqName, setInqName] = useState('');
  const [inqEmail, setInqEmail] = useState('');
  const [inqMobile, setInqMobile] = useState('');

  const fetchTenantSubDetails = async (tenantId) => {
    try {
      const bRes = await dispatch(fetchBookingsThunk({ token, tenantId })).unwrap();
      dispatch(fetchDocumentsThunk({ token, tenantId }));
      dispatch(fetchAgreementsThunk({ token, tenantId }));

      if (bRes && bRes.length > 0) {
        dispatch(fetchCheckinChecklistThunk({ token, bookingId: bRes[0].id }));
        dispatch(fetchCheckoutAuditThunk({ token, bookingId: bRes[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedTenant) {
      fetchTenantSubDetails(selectedTenant.id);
    }
  }, [selectedTenant]);

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(addTenant({ token, firstName: tFirstName, lastName: tLastName, mobile: tMobile })).unwrap();
      setSuccess('Tenant resident registered successfully!');
      setTFirstName(''); setTLastName(''); setTMobile('');
    } catch (err) {
      setError(err || 'Failed to register tenant.');
    }
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addBooking({
        token,
        tenantId: selectedTenant.id,
        bedId: bookingBedId,
        checkinDate: bookingCheckinDate,
        rentAgreed: parseFloat(bookingRentAgreed),
        depositAgreed: parseFloat(bookingDepositAgreed)
      })).unwrap();
      setSuccess('Check-in room booking successfully allocated!');
      fetchTenantSubDetails(selectedTenant.id);
    } catch (err) {
      setError(err || 'Failed to assign booking.');
    }
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addDocument({
        token,
        tenantId: selectedTenant.id,
        documentType: docType,
        documentNumber: docNumber,
        fileUrl: 'https://aws/s3-doc.pdf'
      })).unwrap();
      setSuccess('KYC identification uploaded!');
      setDocNumber('');
      fetchTenantSubDetails(selectedTenant.id);
    } catch (err) {
      setError(err || 'Failed to upload ID.');
    }
  };

  const handleVerifyDocument = async (docId, status) => {
    if (!selectedTenant) return;
    setError(''); setSuccess('');
    try {
      await dispatch(verifyDocumentThunk({ token, tenantId: selectedTenant.id, docId, status })).unwrap();
      setSuccess(`KYC document marked as ${status}!`);
      fetchTenantSubDetails(selectedTenant.id);
    } catch (err) {
      setError(err || 'Failed to update document status.');
    }
  };

  const handleSaveAgreement = async (e) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addAgreement({
        token,
        tenantId: selectedTenant.id,
        terms: agrTerms,
        startDate: agrStartDate,
        endDate: agrEndDate
      })).unwrap();
      setSuccess('Rent agreement drafted successfully!');
      setAgrTerms('');
      fetchTenantSubDetails(selectedTenant.id);
    } catch (err) {
      setError(err || 'Failed to draft agreement.');
    }
  };

  const handleSignAgreement = async (e, agrId) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setError(''); setSuccess('');
    try {
      await dispatch(signAgreementThunk({
        token,
        tenantId: selectedTenant.id,
        agreementId: agrId,
        signatureUrl: signatureText
      })).unwrap();
      setSuccess('Rent agreement signed and activated!');
      setSignatureText('');
      fetchTenantSubDetails(selectedTenant.id);
    } catch (err) {
      setError(err || 'Failed to e-sign agreement.');
    }
  };

  const handleSaveCheckinChecklist = async (e) => {
    e.preventDefault();
    if (bookings.length === 0) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addCheckinChecklist({
        token,
        bookingId: bookings[0].id,
        keysHandedOver: chkKeysHanded,
        amenitiesHandedOver: chkAmenitiesHanded,
        subMeterReading: parseFloat(chkSubmeterVal || '0'),
        notes: chkNotes
      })).unwrap();
      setSuccess('Check-in checklist parameters logged successfully!');
      fetchTenantSubDetails(selectedTenant.id);
    } catch (err) {
      setError(err || 'Failed to save check-in audit.');
    }
  };

  const handleSaveCheckoutAudit = async (e) => {
    e.preventDefault();
    if (bookings.length === 0) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addCheckoutAudit({
        token,
        bookingId: bookings[0].id,
        damagesChecked: outDamagesChecked,
        damageCharges: parseFloat(outDamageCharges || '0'),
        keysReturned: outKeysReturned,
        refundAmount: parseFloat(outRefundAmt || '0'),
        notes: outNotes
      })).unwrap();
      setSuccess('Checkout cleared! Occupied bed inventory released.');
      fetchTenantSubDetails(selectedTenant.id);
    } catch (err) {
      setError(err || 'Failed to log checkout clearance.');
    }
  };

  const handleSaveInquiry = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(addInquiry({ token, guestName: inqName, email: inqEmail, mobile: inqMobile })).unwrap();
      setSuccess('Lead registered in funnel!');
      setInqName(''); setInqEmail(''); setInqMobile('');
    } catch (err) {
      setError(err || 'Failed to log inquiry.');
    }
  };

  const handleConvertLead = async (id) => {
    setError(''); setSuccess('');
    try {
      await dispatch(convertInquiryThunk({ token, inquiryId: id })).unwrap();
      setSuccess('Lead converted successfully!');
    } catch (err) {
      setError(err || 'Failed to convert lead.');
    }
  };

  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>Tenants Onboarding & Audits</h1>
      </header>

      <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '6px', marginBottom: '20px', textAlign: 'left' }}>
        <button className="btn" style={{ flex: 1, background: tenantSubTab === 'residents' ? 'var(--primary)' : 'transparent' }} onClick={() => setTenantSubTab('residents')}>Active Residents</button>
        <button className="btn" style={{ flex: 1, background: tenantSubTab === 'leads' ? 'var(--primary)' : 'transparent' }} onClick={() => setTenantSubTab('leads')}>Leads Funnel</button>
      </div>

      {tenantSubTab === 'residents' && (
        <div style={{ display: 'flex', gap: '20px', textAlign: 'left', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '320px' }} className="card">
            <h3>Add New Resident</h3>
            <form onSubmit={handleSaveTenant} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <input className="form-control" placeholder="First Name" required value={tFirstName} onChange={e => setTFirstName(e.target.value)} />
              <input className="form-control" placeholder="Last Name" required value={tLastName} onChange={e => setTLastName(e.target.value)} />
              <input className="form-control" placeholder="Mobile Number" required value={tMobile} onChange={e => setTMobile(e.target.value)} />
              <button type="submit" className="btn btn-primary">Register Resident</button>
            </form>

            <h3 style={{ marginTop: '20px' }}>Residents Directories</h3>
            {tenants.map(t => (
              <div
                key={t.id}
                style={{
                  padding: '10px',
                  background: selectedTenant?.id === t.id ? 'rgba(99,102,241,0.1)' : 'var(--bg-input)',
                  border: selectedTenant?.id === t.id ? '1px solid var(--primary)' : '1px solid transparent',
                  marginBottom: '6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onClick={() => dispatch(setSelectedTenant(t))}
              >
                <div>
                  <strong>{t.firstName} {t.lastName}</strong>
                  {t.roomNumber && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      🚪 Room {t.roomNumber} {t.bedNumber ? `• Bed ${t.bedNumber}` : ''}
                      {t.propertyName && ` (${t.propertyName})`}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  background: t.status === 'ACTIVE' ? 'rgba(52,211,153,0.2)' : 'rgba(245,158,11,0.2)',
                  color: t.status === 'ACTIVE' ? '#34d399' : '#fbbf24'
                }}>
                  {t.status || 'ACTIVE'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1.5, minWidth: '400px' }} className="card">
            {selectedTenant ? (
              <div>
                <h3>Workspace for {selectedTenant.firstName}</h3>
                
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '6px' }}>
                  <button className="btn" style={{ flexShrink: 0, fontSize: '11px', background: residentViewTab === 'details' ? 'var(--primary)' : 'rgba(255,255,255,0.05)' }} onClick={() => setResidentViewTab('details')}>Details & Booking</button>
                  <button className="btn" style={{ flexShrink: 0, fontSize: '11px', background: residentViewTab === 'kyc' ? 'var(--primary)' : 'rgba(255,255,255,0.05)' }} onClick={() => setResidentViewTab('kyc')}>KYC Verification</button>
                  <button className="btn" style={{ flexShrink: 0, fontSize: '11px', background: residentViewTab === 'agreements' ? 'var(--primary)' : 'rgba(255,255,255,0.05)' }} onClick={() => setResidentViewTab('agreements')}>Lease Agreement</button>
                  <button className="btn" style={{ flexShrink: 0, fontSize: '11px', background: residentViewTab === 'checkin-checklist' ? 'var(--primary)' : 'rgba(255,255,255,0.05)' }} onClick={() => setResidentViewTab('checkin-checklist')}>Audit Checkin</button>
                  <button className="btn" style={{ flexShrink: 0, fontSize: '11px', background: residentViewTab === 'checkout-audit' ? 'var(--primary)' : 'rgba(255,255,255,0.05)' }} onClick={() => setResidentViewTab('checkout-audit')}>Audit Checkout</button>
                </div>

                {/* Tab: Details */}
                {residentViewTab === 'details' && (
                  <div>
                    {bookings.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <p style={{ margin: 0 }}>Booking Status: <strong>{bookings[0].status}</strong></p>
                        <p style={{ margin: 0 }}>Check-in Allocation Date: {bookings[0].checkinDate}</p>
                        <p style={{ margin: 0 }}>Base Rent: INR {bookings[0].rentAgreed} | Security Deposit: INR {bookings[0].depositAgreed}</p>
                        {bookings[0].bed && (
                          <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.2)' }}>
                            <p style={{ margin: '0 0 4px 0' }}>Assigned Bed: <strong>Bed {bookings[0].bed.bedNumber}</strong></p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Location: {bookings[0].bed.propertyName || bookings[0].propertyName || 'Property'} › {bookings[0].bed.buildingName || bookings[0].buildingName || 'Building'} › {bookings[0].bed.floorName || (bookings[0].bed.floorNumber != null ? `Floor ${bookings[0].bed.floorNumber}` : '')} › Room {bookings[0].bed.roomNumber || bookings[0].roomNumber || ''}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveBooking} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600, fontSize: '13px' }}>Select Available Bed</label>
                          <select
                            className="form-control"
                            required
                            value={bookingBedId}
                            onChange={e => {
                              setBookingBedId(e.target.value);
                              const selected = allBedsFlat.find(b => b.id === e.target.value);
                              if (selected && selected.rent) {
                                setBookingRentAgreed(selected.rent.toString());
                              }
                            }}
                          >
                            <option value="">-- Choose Bed (Property › Building › Floor › Room › Bed) --</option>
                            {allBedsFlat.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.propertyName || 'Property'} › {b.buildingName || 'Building'} › {b.floorName || (b.floorNumber != null ? `Floor ${b.floorNumber}` : '')} › Room {b.roomNumber} › Bed {b.bedNumber} ({b.status || 'AVAILABLE'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '13px' }}>Check-in Date</label>
                          <input type="date" className="form-control" required value={bookingCheckinDate} onChange={e => setBookingCheckinDate(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input className="form-control" placeholder="Agreed Monthly Rent (INR)" required value={bookingRentAgreed} onChange={e => setBookingRentAgreed(e.target.value)} />
                          <input className="form-control" placeholder="Agreed Security Deposit (INR)" required value={bookingDepositAgreed} onChange={e => setBookingDepositAgreed(e.target.value)} />
                        </div>
                        <button type="submit" className="btn btn-primary">Allocate Bed Check-in</button>
                      </form>
                    )}
                  </div>
                )}

                {/* Tab: KYC */}
                {residentViewTab === 'kyc' && (
                  <div>
                    <form onSubmit={handleSaveDocument} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                      <select className="form-control" value={docType} onChange={e => setDocType(e.target.value)}>
                        <option value="AADHAAR">Aadhaar Card</option>
                        <option value="PAN">PAN Card</option>
                        <option value="PASSPORT">Passport</option>
                      </select>
                      <input className="form-control" placeholder="Identity Card ID Number" required value={docNumber} onChange={e => setDocNumber(e.target.value)} />
                      <button type="submit" className="btn btn-primary">Upload ID</button>
                    </form>
                    {tenantDocs.map(d => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>{d.documentType}: {d.documentNumber} ({d.status})</span>
                        {d.status === 'PENDING' && (
                          <button className="btn" style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--success)' }} onClick={() => handleVerifyDocument(d.id, 'VERIFIED')}>Approve</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Agreements */}
                {residentViewTab === 'agreements' && (
                  <div>
                    <form onSubmit={handleSaveAgreement} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                      <textarea className="form-control" placeholder="Lease Rules & Agreement terms..." value={agrTerms} onChange={e => setAgrTerms(e.target.value)} />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="date" className="form-control" required value={agrStartDate} onChange={e => setAgrStartDate(e.target.value)} />
                        <input type="date" className="form-control" required value={agrEndDate} onChange={e => setAgrEndDate(e.target.value)} />
                      </div>
                      <button type="submit" className="btn btn-primary">Draft Rent Contract</button>
                    </form>
                    {tenantAgreements.map(a => (
                      <div key={a.id} style={{ padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', marginBottom: '8px' }}>
                        <p>{a.terms}</p>
                        <p>Validity: {a.startDate} to {a.endDate} ({a.status})</p>
                        {a.status === 'PENDING' && (
                          <form onSubmit={(e) => handleSignAgreement(e, a.id)} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <input className="form-control" style={{ flex: 1 }} placeholder="Type signature text to sign" required value={signatureText} onChange={e => setSignatureText(e.target.value)} />
                            <button type="submit" className="btn" style={{ background: 'var(--success)' }}>Sign E-Contract</button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Check-in Checklist */}
                {residentViewTab === 'checkin-checklist' && (
                  <div>
                    {activeCheckinChecklist ? (
                      <div>
                        <p>Keys Handed Over: {activeCheckinChecklist.keysHandedOver ? '🟢 Yes' : '🔴 No'}</p>
                        <p>Amenities Checklist Handed: {activeCheckinChecklist.amenitiesHandedOver ? '🟢 Yes' : '🔴 No'}</p>
                        <p>Meter Starter Reading: ⚡ {activeCheckinChecklist.subMeterReading} units</p>
                        {activeCheckinChecklist.notes && <p>Notes: "{activeCheckinChecklist.notes}"</p>}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveCheckinChecklist} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label><input type="checkbox" checked={chkKeysHanded} onChange={e => setChkKeysHanded(e.target.checked)} /> Handover Keys</label>
                        <label><input type="checkbox" checked={chkAmenitiesHanded} onChange={e => setChkAmenitiesHanded(e.target.checked)} /> Verify Amenities Checklist</label>
                        <input className="form-control" placeholder="Starter Sub-meter reading units" value={chkSubmeterVal} onChange={e => setChkSubmeterVal(e.target.value)} />
                        <input className="form-control" placeholder="Audit Notes" value={chkNotes} onChange={e => setChkNotes(e.target.value)} />
                        <button type="submit" className="btn btn-primary">Complete Check-in Audit</button>
                      </form>
                    )}
                  </div>
                )}

                {/* Tab: Checkout Audit */}
                {residentViewTab === 'checkout-audit' && (
                  <div>
                    {activeCheckoutAudit ? (
                      <div>
                        <p>Keys Returned: {activeCheckoutAudit.keysReturned ? '🟢 Yes' : '🔴 No'}</p>
                        <p>Damages Checked: {activeCheckoutAudit.damagesChecked ? '🟢 Yes' : '🔴 No'}</p>
                        <p>Damage Charges: {activeCheckoutAudit.damageCharges}</p>
                        <p>Deposit Refund settled: {activeCheckoutAudit.refundAmount}</p>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveCheckoutAudit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label><input type="checkbox" checked={outKeysReturned} onChange={e => setOutKeysReturned(e.target.checked)} /> Handback Keys</label>
                        <label><input type="checkbox" checked={outDamagesChecked} onChange={e => setOutDamagesChecked(e.target.checked)} /> Check Room Damages</label>
                        <input className="form-control" placeholder="Assess Damage fee charges" value={outDamageCharges} onChange={e => setOutDamageCharges(e.target.value)} />
                        <input className="form-control" placeholder="Settlement Deposit Refund amount" value={outRefundAmt} onChange={e => setOutRefundAmt(e.target.value)} />
                        <input className="form-control" placeholder="Checkout notes" value={outNotes} onChange={e => setOutNotes(e.target.value)} />
                        <button type="submit" className="btn btn-primary">Log Checkout Clearance</button>
                      </form>
                    )}
                  </div>
                )}

              </div>
            ) : <p style={{ color: 'var(--text-secondary)' }}>Choose a resident profile to view audit workspace dashboards.</p>}
          </div>
        </div>
      )}

      {tenantSubTab === 'leads' && (
        <div style={{ display: 'flex', gap: '20px', textAlign: 'left', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '320px' }} className="card">
            <h3>Add Inquiry / Lead</h3>
            <form onSubmit={handleSaveInquiry} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <input className="form-control" placeholder="Inquirer Guest Name" required value={inqName} onChange={e => setInqName(e.target.value)} />
              <input className="form-control" placeholder="Inquirer Email Address" required value={inqEmail} onChange={e => setInqEmail(e.target.value)} />
              <input className="form-control" placeholder="Mobile Number" required value={inqMobile} onChange={e => setInqMobile(e.target.value)} />
              <button type="submit" className="btn btn-primary">Create Inquiry Lead</button>
            </form>
          </div>
          <div style={{ flex: 1.5, minWidth: '350px' }} className="card">
            <h3>Inquiries Funnel</h3>
            {inquiries.map(inq => (
              <div key={inq.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{inq.guestName} ({inq.mobile}) - <strong>{inq.status}</strong></span>
                {inq.status === 'NEW' && (
                  <button className="btn" style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--success)' }} onClick={() => handleConvertLead(inq.id)}>Convert</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
