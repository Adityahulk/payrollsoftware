const http = require('http');

const adminEmail = "ricxius9@gmail.com";
const adminPassword = "Rick@123";

async function main() {
  console.log(`Logging in as: ${adminEmail}...`);
  
  // Login to get token
  const token = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({ email: adminEmail, password: adminPassword });
    const req = http.request({
      hostname: 'localhost',
      port: 5125,
      path: '/api/Auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (body.Token || body.token) {
            resolve(body.Token || body.token);
          } else {
            reject(new Error("Login failed: " + JSON.stringify(body)));
          }
        } catch (e) {
          reject(new Error("Login parse failed: " + data));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  
  console.log("Token retrieved. Creating Razorpay Order...");
  
  const payload = { amount: 50000 };
  const postBody = JSON.stringify(payload);
  
  const responseData = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5125,
      path: '/api/spaces/6/payroll/razorpay/order',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': postBody.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data
        });
      });
    });
    
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
  
  console.log(`=== Razorpay Order Result ===`);
  console.log(`Status Code: ${responseData.statusCode}`);
  console.log(`Response Body:\n${responseData.body}`);
}

main().catch(err => console.error("Unhandled error:", err));
