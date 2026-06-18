const axios = require('axios');

async function main() {
  try {
    console.log("Fetching payroll data for space 6...");
    const res = await axios.get('http://localhost:5125/api/spaces/6/payroll?applyPenalties=true');
    console.log("Status:", res.status);
    console.log("Data Summary:", res.data.summary);
    console.log("First Evaluation Item:", res.data.evaluations ? res.data.evaluations[0] : null);
    console.log("All evaluations count:", res.data.evaluations?.length);
    console.log("All evaluations:", res.data.evaluations);
  } catch (err) {
    console.error("Error occurred:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    }
  }
}

main();
