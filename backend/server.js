const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const authRouter = require("./router/auth");
const applicationsRouter = require("./router/applications");
const adminRouter = require("./router/admin");
const { initDatabase } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Middlesville Trusted Loans API" });
});

app.use((req, res) => {
  res.status(404).json({ message: "API route was not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Server error." });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Middlesville Trusted Loans server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize MySQL database.");
    if (error && error.code === "ECONNREFUSED") {
      console.error(
        `MySQL is not accepting connections at ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306}.`
      );
      console.error("Start MySQL, then run `npm run dev` again.");
    }
    console.error(error);
    process.exit(1);
  });
