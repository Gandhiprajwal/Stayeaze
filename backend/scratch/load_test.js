const http = require('http');

const BASE_URL = 'http://localhost:8080';

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

async function runBenchmark() {
  console.log('🚀 Starting StayEaze API Latency & Load Test against http://localhost:8080\n');

  // 1. Authenticate as SuperAdmin
  console.log('🔑 Authenticating as SuperAdmin (superadmin@stayeaze.com)...');
  const loginPayload = JSON.stringify({
    email: 'superadmin@stayeaze.com',
    username: 'superadmin@stayeaze.com',
    password: 'Friend@2010'
  });

  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, loginPayload);

  let token = null;
  if (loginRes.statusCode === 200 && (loginRes.data?.accessToken || loginRes.data?.token)) {
    token = loginRes.data.accessToken || loginRes.data.token;
    console.log(`✅ Login Successful (${loginRes.duration}ms). JWT Token acquired.`);
  } else {
    console.log(`⚠️ Login Status: ${loginRes.statusCode}. Response: ${loginRes.raw ? loginRes.raw.substring(0, 150) : loginRes.error}`);
  }

  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const endpointsToTest = [
    { name: 'SaaS Plans (Public)', path: '/api/v1/saas/plans', method: 'GET', auth: false },
    { name: 'Properties List', path: '/api/v1/properties?page=1&pageSize=10', method: 'GET', auth: true },
    { name: 'Tenants List', path: '/api/v1/tenants?page=1&pageSize=10', method: 'GET', auth: true },
    { name: 'Bookings List', path: '/api/v1/bookings?page=1&pageSize=10', method: 'GET', auth: true },
    { name: 'Complaints Queue', path: '/api/v1/complaints', method: 'GET', auth: true },
    { name: 'Visitors Log', path: '/api/v1/visitors?page=1&pageSize=10', method: 'GET', auth: true },
    { name: 'Support Tickets Queue', path: '/api/v1/support/tickets?page=1&pageSize=10', method: 'GET', auth: true },
    { name: 'Tenant Portal Complaints', path: '/api/v1/tenant-portal/complaints', method: 'GET', auth: true },
    { name: 'SuperAdmin Subscribers', path: '/api/v1/super-admin/subscribers?page=1&pageSize=10', method: 'GET', auth: true }
  ];

  console.log('\n-----------------------------------------------------------------------------------------------------');
  console.log('| Endpoint Name              | Path                                | Status | Avg Latency (ms) | Range       |');
  console.log('-----------------------------------------------------------------------------------------------------');

  const results = [];

  for (const ep of endpointsToTest) {
    const CONCURRENCY = 10;
    const reqPromises = [];
    const reqHeaders = ep.auth ? headers : { 'Content-Type': 'application/json' };

    for (let i = 0; i < CONCURRENCY; i++) {
      reqPromises.push(makeRequest({
        hostname: 'localhost',
        port: 8080,
        path: ep.path,
        method: ep.method,
        headers: reqHeaders
      }));
    }

    const responses = await Promise.all(reqPromises);
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
      maxDuration,
      concurrency: CONCURRENCY
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

  console.log('📊 Performance Diagnostic Summary:');
  const authenticatedOk = results.filter(r => r.statusCode === 200);
  const slowAPIs = results.filter(r => r.statusCode === 200 && r.avgDuration > 200);

  console.log(`- Total Endpoints Benchmarked: ${results.length}`);
  console.log(`- Successful Responses (200 OK): ${authenticatedOk.length} / ${results.length}`);

  if (slowAPIs.length > 0) {
    console.log('⚠️  The following APIs exceeded 200ms target response time:');
    slowAPIs.forEach(s => {
      console.log(`   - ${s.name} (${s.path}): Avg ${s.avgDuration}ms (Max ${s.maxDuration}ms)`);
    });
  } else if (authenticatedOk.length > 0) {
    console.log('⚡ ALL tested active APIs responded well within optimal target (< 200ms)!');
  }
}

runBenchmark();
