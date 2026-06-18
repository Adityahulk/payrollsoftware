const { Client } = require('pg');

const connectionString = "postgresql://nehal_kumar_12:rEe8eVB2qGyWXAdgjx66qdtVIRnmK007@dpg-d81frdbtqb8s738c3ik0-a.oregon-postgres.render.com:5432/payroll_db_kfrz?ssl=true";

async function main() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log("=== Users ===");
  const resUsers = await client.query("SELECT empid, email, role, spaceid FROM t_users;");
  console.log(resUsers.rows);

  console.log("\n=== t_employeesalary ===");
  const resEmpSal = await client.query("SELECT * FROM t_employeesalary;");
  console.log(resEmpSal.rows);

  console.log("\n=== t_salary ===");
  const resSal = await client.query("SELECT * FROM t_salary;");
  console.log(resSal.rows);

  console.log("\n=== t_allowances ===");
  const resAllow = await client.query("SELECT * FROM t_allowances;");
  console.log(resAllow.rows);

  console.log("\n=== t_deductions ===");
  const resDed = await client.query("SELECT * FROM t_deductions;");
  console.log(resDed.rows);
  
  await client.end();
}

main().catch(err => console.error(err));
