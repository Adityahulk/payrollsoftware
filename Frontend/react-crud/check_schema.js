const { Client } = require('pg');

const connectionString = "postgresql://nehal_kumar_12:rEe8eVB2qGyWXAdgjx66qdtVIRnmK007;SSL Mode=Require;Trust Server Certificate=true;@dpg-d81frdbtqb8s738c3ik0-a.oregon-postgres.render.com:5432/payroll_db_kfrz?ssl=true";
// Actually let's use the clean URL format that worked:
const url = "postgresql://nehal_kumar_12:rEe8eVB2qGyWXAdgjx66qdtVIRnmK007@dpg-d81frdbtqb8s738c3ik0-a.oregon-postgres.render.com:5432/payroll_db_kfrz?ssl=true";

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log("=== Columns of t_payrollpayments ===");
  const resPP = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 't_payrollpayments';
  `);
  console.log(resPP.rows);
  
  console.log("=== Columns of t_payslips ===");
  const resPS = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 't_payslips';
  `);
  console.log(resPS.rows);

  console.log("=== Columns of t_users ===");
  const resU = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 't_users';
  `);
  console.log(resU.rows);
  
  await client.end();
}

main().catch(err => console.error(err));
