const http = require('http');

const HOST = 'localhost';
const PORT = 8080;

function makeRequest(options, postData) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch(e) {}
        resolve({ statusCode: res.statusCode, data: parsed, raw: body });
      });
    });
    req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runLedgerTest() {
  console.log('🚀 Testing General Ledger Transaction Population...');

  // 1. Login
  const loginPayload = JSON.stringify({ email: 'gandhiprajwal6@gmail.com', password: 'Friend@2010' });
  const loginRes = await makeRequest({
    hostname: HOST, port: PORT, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginPayload) }
  }, loginPayload);

  if (loginRes.statusCode !== 200 || !loginRes.data?.accessToken) {
    console.log('❌ Login failed:', loginRes.statusCode);
    return;
  }
  const token = loginRes.data.accessToken;
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  // 2. Post a Test Expense (Debit Entry)
  console.log('➕ Recording test expense (Electricity Bill ₹4,500)...');
  const expensePayload = JSON.stringify({
    category: 'Electricity & Water',
    description: 'Monthly EB Utility Bill Payment',
    amount: 4500.00,
    paymentMethod: 'UPI',
    vendorName: 'State Electricity Board'
  });

  const expRes = await makeRequest({
    hostname: HOST, port: PORT, path: '/api/v1/accountant/expenses', method: 'POST',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(expensePayload) }
  }, expensePayload);

  console.log(`Expense Record Status: ${expRes.statusCode} (${expRes.statusCode === 200 || expRes.statusCode === 201 ? 'Success' : 'Failed'})`);

  // 3. Fetch General Ledger
  console.log('📋 Fetching General Ledger & Cashbook entries...');
  const ledgerRes = await makeRequest({
    hostname: HOST, port: PORT, path: '/api/v1/accountant/ledger', method: 'GET',
    headers: headers
  });

  console.log(`\nStatus Code: ${ledgerRes.statusCode}`);
  console.log('Ledger Items Returned:', Array.isArray(ledgerRes.data) ? ledgerRes.data.length : 0);
  console.log('\n--- Live Ledger Data Snippet ---');
  console.dir(ledgerRes.data, { depth: null });
}

runLedgerTest();
