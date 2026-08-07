import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addBillingPlanThunk,
  addInvoiceThunk,
  addAdjustmentThunk,
  reverseAdjustmentThunk,
  addMeterReadingThunk,
  addPaymentThunk,
  fetchTenantInvoicesThunk,
  fetchAdjustmentsThunk,
  fetchMeterReadingsThunk,
  fetchInvoicePaymentsThunk,
  clearTenantBillingDetails
} from '../store/slices/billingSlice';
import { fetchBookingsThunk } from '../store/slices/tenantSlice';
import { api } from '../services/api';

export default function BillingPanel({ token, tenants, billingPlans, fetchBillingPlans, setError, setSuccess }) {
  const dispatch = useDispatch();

  const [billingSubSection, setBillingSubSection] = useState('invoice'); // 'invoice', 'adjustments', 'utilities'
  const [billingTenantId, setBillingTenantId] = useState('');

  // Plans
  const [planName, setPlanName] = useState('');
  const [planBaseRent, setPlanBaseRent] = useState('');
  const [planFoodCharges, setPlanFoodCharges] = useState('');
  const [planOtherCharges, setPlanOtherCharges] = useState('');
  const [planCycle, setPlanCycle] = useState('MONTHLY');

  // Invoices & Payments
  const tenantInvoices = useSelector(state => state.billing.tenantInvoices);
  const [invDueDate, setInvDueDate] = useState('');
  const [invIssueDate, setInvIssueDate] = useState('');
  const [invRentVal, setInvRentVal] = useState('');
  const [invFoodVal, setInvFoodVal] = useState('');
  const [invOtherVal, setInvOtherVal] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payReference, setPayReference] = useState('');
  const invoicePayments = useSelector(state => state.billing.invoicePayments);

  // Adjustments
  const adjustments = useSelector(state => state.billing.tenantAdjustments);
  const [adjType, setAdjType] = useState('PENALTY');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');

  // Utilities
  const meterReadings = useSelector(state => state.billing.roomMeterReadings);
  const [metReadingDate, setMetReadingDate] = useState('');
  const [metReadingValue, setMetReadingValue] = useState('');
  const [metUnitRate, setMetUnitRate] = useState('');

  const fetchBillingTenantDetails = async (tenantId) => {
    try {
      dispatch(fetchTenantInvoicesThunk({ token, tenantId }));
      dispatch(fetchAdjustmentsThunk({ token, tenantId }));

      const bRes = await dispatch(fetchBookingsThunk({ token, tenantId })).unwrap();
      if (bRes && bRes.length > 0 && bRes[0].bed?.room) {
        const roomId = bRes[0].bed.room.id;
        dispatch(fetchMeterReadingsThunk({ token, roomId }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (billingTenantId) {
      fetchBillingTenantDetails(billingTenantId);
      setSelectedInvoice(null);
      setShowPayForm(false);
    } else {
      dispatch(clearTenantBillingDetails());
      setSelectedInvoice(null);
    }
  }, [billingTenantId]);

  useEffect(() => {
    if (selectedInvoice) {
      dispatch(fetchInvoicePaymentsThunk({ token, tenantId: billingTenantId, invoiceId: selectedInvoice.id }));
    }
  }, [selectedInvoice]);

  const handleSaveBillingPlan = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await dispatch(addBillingPlanThunk({
        token,
        name: planName,
        baseRent: parseFloat(planBaseRent),
        foodCharges: parseFloat(planFoodCharges || '0'),
        otherCharges: parseFloat(planOtherCharges || '0'),
        billingCycle: planCycle
      })).unwrap();
      setSuccess('Billing Plan template registered!');
      setPlanName(''); setPlanBaseRent(''); setPlanFoodCharges(''); setPlanOtherCharges('');
    } catch (err) {
      setError(err || 'Failed to create billing plan.');
    }
  };

  const applyBillingPlanToInvoice = (plan) => {
    setInvRentVal(plan.baseRent);
    setInvFoodVal(plan.foodCharges);
    setInvOtherVal(plan.otherCharges);
  };

  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    if (!billingTenantId) return;
    setError(''); setSuccess('');

    const rent = parseFloat(invRentVal || '0');
    const food = parseFloat(invFoodVal || '0');
    const other = parseFloat(invOtherVal || '0');
    const totalAmount = rent + food + other;

    const items = [
      { description: 'Monthly Base Rent', amount: rent },
      { description: 'Food & Catering Charges', amount: food },
      { description: 'Utilities General allocations', amount: other }
    ].filter(i => i.amount > 0);

    try {
      await dispatch(addInvoiceThunk({
        token,
        tenantId: billingTenantId,
        dueDate: invDueDate,
        issueDate: invIssueDate,
        amountDue: totalAmount,
        items
      })).unwrap();
      setSuccess('Invoice generated successfully!');
      setInvRentVal(''); setInvFoodVal(''); setInvOtherVal('');
      fetchBillingTenantDetails(billingTenantId);
    } catch (err) {
      setError(err || 'Failed to generate invoice.');
    }
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!billingTenantId) return;
    setError(''); setSuccess('');
    try {
      await dispatch(addAdjustmentThunk({
        token,
        tenantId: billingTenantId,
        type: adjType,
        amount: parseFloat(adjAmount),
        description: adjDesc
      })).unwrap();
      setSuccess('Adjustment logged to ledger!');
      setAdjAmount(''); setAdjDesc('');
      fetchBillingTenantDetails(billingTenantId);
    } catch (err) {
      setError(err || 'Failed to apply adjustment.');
    }
  };

  const handleReverseAdjustment = async (adjId) => {
    if (!billingTenantId) return;
    setError(''); setSuccess('');
    try {
      await dispatch(reverseAdjustmentThunk({ token, tenantId: billingTenantId, id: adjId })).unwrap();
      setSuccess('Adjustment reversed.');
      fetchBillingTenantDetails(billingTenantId);
    } catch (err) {
      setError(err || 'Failed to reverse adjustment.');
    }
  };

  const handleSaveMeterReading = async (e) => {
    e.preventDefault();
    if (!billingTenantId) return;
    setError(''); setSuccess('');

    try {
      const bookingsRes = await dispatch(fetchBookingsThunk({ token, tenantId: billingTenantId })).unwrap();
      if (bookingsRes.length === 0 || !bookingsRes[0].bed?.room) {
        throw new Error('Resident has no active room assignment to log meters.');
      }
      const roomId = bookingsRes[0].bed.room.id;
      await dispatch(addMeterReadingThunk({
        token,
        roomId,
        readingDate: metReadingDate,
        readingValue: parseFloat(metReadingValue),
        unitRate: parseFloat(metUnitRate)
      })).unwrap();
      setSuccess('Electricity sub-meter units logged!');
      setMetReadingValue(''); setMetUnitRate('');
      fetchBillingTenantDetails(billingTenantId);
    } catch (err) {
      setError(err.message || 'Failed to log utility reading.');
    }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!billingTenantId || !selectedInvoice) return;
    setError(''); setSuccess('');

    try {
      await dispatch(addPaymentThunk({
        token,
        tenantId: billingTenantId,
        invoiceId: selectedInvoice.id,
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        transactionReference: payReference
      })).unwrap();
      setSuccess('Payment transaction recorded successfully!');
      setPayAmount(''); setPayReference('');
      setShowPayForm(false);
      fetchBillingTenantDetails(billingTenantId);
      dispatch(fetchInvoicePaymentsThunk({ token, tenantId: billingTenantId, invoiceId: selectedInvoice.id }));
    } catch (err) {
      setError(err || 'Failed to process payment transaction.');
    }
  };

  return (
    <>
      <header style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', textAlign: 'left' }}>Rent Plans & Invoices</h1>
      </header>

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', textAlign: 'left' }}>
        <div style={{ flex: '1', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3>⚙️ Monthly Billing Templates</h3>
            <form onSubmit={handleSaveBillingPlan} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
              <input type="text" className="form-control" placeholder="Plan name" required value={planName} onChange={e => setPlanName(e.target.value)} />
              <input type="number" className="form-control" placeholder="Base Monthly Rent" required value={planBaseRent} onChange={e => setPlanBaseRent(e.target.value)} />
              <input type="number" className="form-control" placeholder="Food charges" value={planFoodCharges} onChange={e => setPlanFoodCharges(e.target.value)} />
              <input type="number" className="form-control" placeholder="Shared utilities rate" value={planOtherCharges} onChange={e => setPlanOtherCharges(e.target.value)} />
              <button type="submit" className="btn btn-primary">Create Plan Template</button>
            </form>
          </div>

          <div className="card">
            <h4>Templates List</h4>
            {billingPlans.map(plan => (
              <div key={plan.id} style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{plan.name}</span>
                <button className="btn" style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(99,102,241,0.15)', color: '#818cf8' }} onClick={() => applyBillingPlanToInvoice(plan)}>Apply</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '2', minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h3>💳 Statement Operations</h3>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label className="form-label">Select Tenant / Resident</label>
              <select className="form-control" value={billingTenantId} onChange={e => setBillingTenantId(e.target.value)}>
                <option value="">-- Choose Resident --</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </div>

            {billingTenantId && (
              <div>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '6px', marginBottom: '15px' }}>
                  <button className="btn" style={{ flex: 1, fontSize: '12px', background: billingSubSection === 'invoice' ? 'var(--primary)' : 'transparent' }} onClick={() => setBillingSubSection('invoice')}>Generate Invoice</button>
                  <button className="btn" style={{ flex: 1, fontSize: '12px', background: billingSubSection === 'adjustments' ? 'var(--primary)' : 'transparent' }} onClick={() => setBillingSubSection('adjustments')}>Penalties / Discounts</button>
                  <button className="btn" style={{ flex: 1, fontSize: '12px', background: billingSubSection === 'utilities' ? 'var(--primary)' : 'transparent' }} onClick={() => setBillingSubSection('utilities')}>Electricity Submeter</button>
                </div>

                {billingSubSection === 'invoice' && (
                  <form onSubmit={handleGenerateInvoice}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input type="date" className="form-control" required value={invIssueDate} onChange={e => setInvIssueDate(e.target.value)} />
                      <input type="date" className="form-control" required value={invDueDate} onChange={e => setInvDueDate(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                      <input type="number" className="form-control" placeholder="Base Rent" required value={invRentVal} onChange={e => setInvRentVal(e.target.value)} />
                      <input type="number" className="form-control" placeholder="Food Charges" value={invFoodVal} onChange={e => setInvFoodVal(e.target.value)} />
                      <input type="number" className="form-control" placeholder="Shared Utilities" value={invOtherVal} onChange={e => setInvOtherVal(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">Generate Rent Invoice</button>
                  </form>
                )}

                {billingSubSection === 'adjustments' && (
                  <div>
                    <form onSubmit={handleSaveAdjustment} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                      <select className="form-control" value={adjType} onChange={e => setAdjType(e.target.value)} style={{ flex: 1 }}>
                        <option value="PENALTY">Penalty Fee</option>
                        <option value="DISCOUNT">Discount Rate</option>
                      </select>
                      <input type="number" className="form-control" placeholder="Amount" required value={adjAmount} onChange={e => setAdjAmount(e.target.value)} style={{ flex: 1 }} />
                      <input type="text" className="form-control" placeholder="Description" required value={adjDesc} onChange={e => setAdjDesc(e.target.value)} style={{ flex: 1.5 }} />
                      <button type="submit" className="btn btn-primary">Apply</button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {adjustments.map(adj => (
                        <div key={adj.id} style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: adj.type === 'PENALTY' ? '#f87171' : '#34d399', fontWeight: 'bold', marginRight: '8px' }}>[{adj.type}]</span>
                            <span>INR {adj.amount} - {adj.description} ({adj.status})</span>
                          </div>
                          {adj.status === 'APPLIED' && (
                            <button className="btn" style={{ padding: '2px 6px', fontSize: '11px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }} onClick={() => handleReverseAdjustment(adj.id)}>Reverse</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {billingSubSection === 'utilities' && (
                  <div>
                    <form onSubmit={handleSaveMeterReading} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                      <input type="date" className="form-control" required value={metReadingDate} onChange={e => setMetReadingDate(e.target.value)} style={{ flex: 1 }} />
                      <input type="number" className="form-control" placeholder="Units read" required value={metReadingValue} onChange={e => setMetReadingValue(e.target.value)} style={{ flex: 1 }} />
                      <input type="number" className="form-control" placeholder="Rate / unit" required value={metUnitRate} onChange={e => setMetUnitRate(e.target.value)} style={{ flex: 1 }} />
                      <button type="submit" className="btn btn-primary">Log Utility</button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {meterReadings.map(met => (
                        <div key={met.id} style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>📅 {met.readingDate} | Reading: {met.readingValue} units @ {met.unitRate}/unit</span>
                          <strong>Charge: INR {met.totalAmount}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {billingTenantId && (
            <div className="card">
              <h3>📜 Invoices List</h3>
              {tenantInvoices.map(inv => (
                <div key={inv.id} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSelectedInvoice(selectedInvoice?.id === inv.id ? null : inv)}>
                    <strong>{inv.invoiceNumber}</strong>
                    <span>{inv.status}</span>
                  </div>
                  <p>Due Amount: INR {inv.amountDue} | Paid: {inv.amountPaid}</p>
                  
                  {inv.status !== 'PAID' && (
                    <button className="btn" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '11px', padding: '4px 8px', marginRight: '5px', marginTop: '5px' }} onClick={() => { setSelectedInvoice(inv); setPayAmount(inv.amountDue - inv.amountPaid); setShowPayForm(true); }}>Pay Invoice</button>
                  )}
                  <button className="btn" style={{ background: 'rgba(255,255,255,0.06)', fontSize: '11px', padding: '4px 8px', marginTop: '5px' }} onClick={() => setSelectedInvoice(selectedInvoice?.id === inv.id ? null : inv)}>
                    {selectedInvoice?.id === inv.id ? 'Hide Payments' : 'View Payments'}
                  </button>

                  {selectedInvoice?.id === inv.id && (
                    <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                      <h5>Transactions & Receipts</h5>
                      {invoicePayments.length === 0 ? <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No transactions processed.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {invoicePayments.map(pay => (
                            <div key={pay.id} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>💸 {pay.paymentMethod} - INR {pay.amount} ({pay.status})</span>
                              {pay.receiptUrl && (
                                <a href={pay.receiptUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>PDF Receipt</a>
                              )}
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

          {showPayForm && selectedInvoice && (
            <div className="card" style={{ border: '1px solid var(--primary)', background: 'rgba(99,102,241,0.1)' }}>
              <h3>💸 Process Payment for {selectedInvoice.invoiceNumber}</h3>
              <form onSubmit={handleProcessPayment} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                <input type="number" className="form-control" placeholder="Amount to pay" required value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ flex: 1 }} />
                <select className="form-control" value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ flex: 1 }}>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CASH">Cash Payment</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                </select>
                <input type="text" className="form-control" placeholder="Transaction Ref ID" value={payReference} onChange={e => setPayReference(e.target.value)} style={{ flex: 1.5 }} />
                <button type="submit" className="btn btn-primary">Process</button>
                <button type="button" className="btn" onClick={() => setShowPayForm(false)} style={{ background: 'var(--bg-input)' }}>Cancel</button>
              </form>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
