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

async function testEnableGST() {
  console.log('🚀 Testing Enabling Valid GSTIN (27AAAAA0000A1Z5)...');

  // 1. Login
  const loginPayload = JSON.stringify({ email: 'gandhiprajwal6@gmail.com', password: 'Friend@2010' });
  const loginRes = await makeRequest({
    hostname: HOST, port: PORT, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginPayload) }
  }, loginPayload);

  const token = loginRes.data.accessToken;
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  // 2. Enable Valid GST
  const validPayload = JSON.stringify({
    gstEnabled: true,
    gstin: '27AAAAA0000A1Z5',
    gstTradeName: 'Greenland PG Group Private Limited',
    defaultGstRate: 18.0
  });

  console.log('1️⃣ PUT /api/v1/organization/financial-settings (Valid GSTIN)...');
  const enableRes = await makeRequest({
    hostname: HOST, port: PORT, path: '/api/v1/organization/financial-settings', method: 'PUT',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(validPayload) }
  }, validPayload);
  console.log(`   Status: ${enableRes.statusCode} (${enableRes.statusCode === 200 ? '✅ Updated' : '❌ Failed'})`);
  console.log(`   Response:`, enableRes.data);

  // 3. GET Accountant Overview when GST Enabled
  console.log('\n2️⃣ GET /api/v1/accountant/overview (Verify Active GST Liability Calculation)...');
  const overviewRes = await makeRequest({
    hostname: HOST, port: PORT, path: '/api/v1/accountant/overview', method: 'GET',
    headers: headers
  });
  console.log(`   Status: ${overviewRes.statusCode}`);
  console.log(`   gstEnabled: ${overviewRes.data?.gstEnabled}`);
  console.log(`   gstin: ${overviewRes.data?.gstin}`);
  console.log(`   estimatedGstLiability: ₹${overviewRes.data?.estimatedGstLiability}`);

  // 4. Disable GST back (Default state for PG exemption)
  console.log('\n3️⃣ Disabling GST back for PG Exemption Default State...');
  const disablePayload = JSON.stringify({
    gstEnabled: false,
    gstin: '27AAAAA0000A1Z5',
    gstTradeName: 'Greenland PG Group Private Limited',
    defaultGstRate: 18.0
  });
  await makeRequest({
    hostname: HOST, port: PORT, path: '/api/v1/organization/financial-settings', method: 'PUT',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(disablePayload) }
  }, disablePayload);
  console.log('   ✅ GST Disabled back.');
}

testEnableGST();
