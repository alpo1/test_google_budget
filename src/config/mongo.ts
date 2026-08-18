import mongoose from "mongoose";
import { env } from "./env";

mongoose.set("bufferCommands", false);

export async function connectMongo(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URL, { serverSelectionTimeoutMS: 2000 });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.warn("MongoDB not connected — audit logging will operate in offline mode");
  }
}

export async function disconnectMongo(): Promise<void> {
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore error on disconnect
  }
}
