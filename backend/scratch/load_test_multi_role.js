const http = require('http');

const HOST = 'localhost';
const PORT = 8080;

function makeRequest(options, postData) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch(e) {}
        resolve({
          statusCode: res.statusCode,
          duration,
          data: parsed,
          raw: body
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        duration: Date.now() - startTime,
        error: err.message
      });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginUser(email, password) {
  const payload = JSON.stringify({ email, username: email, password });
  const res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);

  if (res.statusCode === 200 && (res.data?.accessToken || res.data?.token)) {
    return { success: true, token: res.data.accessToken || res.data.token, duration: res.duration };
  }
  return { success: false, statusCode: res.statusCode, error: res.raw || res.error, duration: res.duration };
}

async function benchmarkEndpoints(roleName, token, endpoints, concurrency = 5, delayMs = 20) {
  console.log(`\n=====================================================================================================`);
  console.log(`🎯 BENCHMARKING APIS FOR ROLE: ${roleName.toUpperCase()}`);
  console.log(`=====================================================================================================`);
  console.log('| Endpoint Name              | Path                                | Status | Avg Latency (ms) | Range       |');
  console.log('-----------------------------------------------------------------------------------------------------');

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const results = [];

  for (const ep of endpoints) {
    const responses = [];
    for (let i = 0; i < concurrency; i++) {
      if (delayMs > 0 && i > 0) await sleep(delayMs);
      const res = await makeRequest({
        hostname: HOST,
        port: PORT,
        path: ep.path,
        method: ep.method || 'GET',
        headers: headers
      });
      responses.push(res);
    }

    const validDurations = responses.map(r => r.duration);
    const avgDuration = Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length);
    const maxDuration = Math.max(...validDurations);
    const minDuration = Math.min(...validDurations);
    const statusCode = responses[0].statusCode;

    results.push({
      name: ep.name,
      path: ep.path,
      statusCode,
      avgDuration,
      minDuration,
      maxDuration
    });

    const statusStr = statusCode === 200 ? '200 OK' : `${statusCode} ERR`;
    const nameFormatted = ep.name.padEnd(26, ' ');
    const pathFormatted = ep.path.padEnd(35, ' ');
    const statusFormatted = statusStr.padEnd(6, ' ');
    const timeFormatted = `${avgDuration} ms`.padEnd(16, ' ');
    const rangeFormatted = `${minDuration}-${maxDuration} ms`.padEnd(11, ' ');

    console.log(`| ${nameFormatted} | ${pathFormatted} | ${statusFormatted} | ${timeFormatted} | ${rangeFormatted} |`);
  }

  console.log('-----------------------------------------------------------------------------------------------------\n');
  return results;
}

async function runMultiRoleLoadTest() {
  console.log('🚀 Starting StayEaze Accounting & Finance Benchmark against http://localhost:8080');

  // 1. Authenticate Admin / Owner User
  console.log('\n🔑 Authenticating Admin/Owner (gandhiprajwal6@gmail.com)...');
  const ownerAuth = await loginUser('gandhiprajwal6@gmail.com', 'Friend@2010');
  if (ownerAuth.success) {
    console.log(`✅ Admin/Owner Login Successful (${ownerAuth.duration}ms).`);
  } else {
    console.log(`❌ Admin/Owner Login Failed (${ownerAuth.statusCode}).`);
  }

  // 2. Admin / Owner Accounting Endpoints
  if (ownerAuth.token) {
    const accountingEndpoints = [
      { name: 'Accountant Overview', path: '/api/v1/accountant/overview' },
      { name: 'General Ledger', path: '/api/v1/accountant/ledger' },
      { name: 'GST & Tax Reports', path: '/api/v1/reports/gst-tax' },
      { name: 'Security Deposit Ledger', path: '/api/v1/reports/security-deposits' }
    ];
    await benchmarkEndpoints('Admin / Owner (Accounting)', ownerAuth.token, accountingEndpoints, 5, 20);
  }
}

runMultiRoleLoadTest();
