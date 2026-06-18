const { Client } = require('pg');

const connectionString = "postgresql://nehal_kumar_12:rEe8eVB2qGyWXAdgjx66qdtVIRnmK007@dpg-d81frdbtqb8s738c3ik0-a.oregon-postgres.render.com:5432/payroll_db_kfrz?ssl=true";

async function main() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log("=== Attendance Status Breakdown ===");
  const statusCounts = await client.query("SELECT status, COUNT(*) FROM t_attendance GROUP BY status;");
  console.log(statusCounts.rows);

  console.log("=== Sample Attendance Records ===");
  const sample = await client.query("SELECT * FROM t_attendance LIMIT 10;");
  console.log(sample.rows);

  await client.end();
}

main().catch(err => console.error(err));
