const { Client } = require('pg');
const connectionString = "postgresql://nehal_kumar_12:rEe8eVB2qGyWXAdgjx66qdtVIRnmK007@dpg-d81frdbtqb8s738c3ik0-a.oregon-postgres.render.com:5432/payroll_db_kfrz?ssl=true";

async function main() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query("SELECT empid, email, passwordhash, role, spaceid FROM t_users WHERE empid IN (10, 14);");
  console.log(res.rows);
  await client.end();
}
main().catch(console.error);
