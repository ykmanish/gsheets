const fs = require("fs");
const path = require("path");
const dns = require("dns");
const { MongoClient } = require("mongodb");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

async function main() {
  const projectDashboardPath = path.join(__dirname, "..", "data", "project-dashboard.json");
  const rawConfig = fs.existsSync(projectDashboardPath)
    ? JSON.parse(fs.readFileSync(projectDashboardPath, "utf8"))
    : { projects: [] };
  const config = {
    projects: Array.isArray(rawConfig.projects) ? rawConfig.projects : [],
  };

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is not configured.");

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();
  await db.collection("projectDashboard").updateOne(
    { _id: "default" },
    {
      $set: {
        config,
        source: "manual-migration",
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  await client.close();

  console.log(JSON.stringify({
    ok: true,
    database: db.databaseName,
    collection: "projectDashboard",
    documentId: "default",
    projects: config.projects.length,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
