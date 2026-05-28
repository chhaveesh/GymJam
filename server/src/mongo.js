import { MongoClient } from "mongodb";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "gymjam";

const client = new MongoClient(MONGO_URL);
let db;

export async function connectMongo() {
  await client.connect();
  db = client.db(DB_NAME);
  // tallies: durable copy of the live Redis counters, keyed by "gym:track".
  await db.collection("tallies").createIndex({ gymId: 1, trackId: 1 }, { unique: true });
  return db;
}

export function getDb() {
  if (!db) throw new Error("Mongo not connected — call connectMongo() first");
  return db;
}
