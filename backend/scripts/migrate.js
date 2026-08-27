require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { initDatabase, pool } = require("../db");

initDatabase()
  .then(async () => {
    console.log("MySQL migrations completed.");
    await pool.end();
  })
  .catch(async (error) => {
    console.error("MySQL migration failed.");
    console.error(error);
    await pool.end().catch(() => {});
    process.exit(1);
  });
