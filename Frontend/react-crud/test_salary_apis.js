const http = require('http');

const loginPayload = JSON.stringify({
  email: 'test@employee2.com',
  password: 'Emp@123'
});

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Login
  console.log("Logging in...");
  const loginRes = await request({
    hostname: 'localhost',
    port: 5125,
    path: '/api/Auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, loginPayload);

  if (loginRes.statusCode !== 200) {
    console.error("Login failed:", loginRes.body);
    return;
  }

  const token = loginRes.body.token;
  console.log("Logged in successfully. Token obtained.");

  const getHeaders = {
    'Authorization': `Bearer ${token}`
  };

  const endpoints = [
    { name: 'Salary Breakdown', path: '/api/Salary/me?month=5&year=2026' },
    { name: 'Payroll Impact', path: '/api/payroll/impact' },
    { name: 'CTC Summary', path: '/api/payroll/ctc-summary?year=2026' },
    { name: 'Progress Report', path: '/api/Salary/progress' },
    { name: 'Payment History', path: '/api/payroll/history' },
    { name: 'Performance Grade', path: '/api/performance' },
    { name: 'Productivity Score', path: '/api/analytics/productivity' }
  ];

  for (const ep of endpoints) {
    console.log(`\n--- Fetching ${ep.name} (${ep.path}) ---`);
    const res = await request({
      hostname: 'localhost',
      port: 5125,
      path: ep.path,
      method: 'GET',
      headers: getHeaders
    });
    console.log(`Status: ${res.statusCode}`);
    console.log("Response:", JSON.stringify(res.body, null, 2));
  }
}

main().catch(console.error);
