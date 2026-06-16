const { Client } = require('pg');

const connectionString = "postgresql://nehal_kumar_12:rEe8eVB2qGyWXAdgjx66qdtVIRnmK007@dpg-d81frdbtqb8s738c3ik0-a.oregon-postgres.render.com:5432/payroll_db_kfrz?ssl=true";

async function main() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  
  console.log("Adding workingdays column to t_spaces...");
  
  try {
    await client.query(`
      ALTER TABLE t_spaces 
      ADD COLUMN IF NOT EXISTS workingdays TEXT DEFAULT '["Mon","Tue","Wed","Thu","Fri"]';
    `);
    console.log("Column workingdays added or already exists.");
    
    // Update any rows where workingdays might be null (just in case)
    const updateRes = await client.query(`
      UPDATE t_spaces 
      SET workingdays = '["Mon","Tue","Wed","Thu","Fri"]' 
      WHERE workingdays IS NULL;
    `);
    console.log(`Updated ${updateRes.rowCount} spaces to have default workingdays.`);
  } catch (err) {
    console.error("Migration error:", err);
  }

  const spaces = await client.query("SELECT spaceid, spacename, workingdays FROM t_spaces;");
  console.log("Current spaces with workingdays:");
  console.log(spaces.rows);

  await client.end();
}

main().catch(err => console.error(err));
