// src/network.js
import https from "https";
import dns from "dns/promises";

export const httpsAgent = new https.Agent({
  minVersion: "TLSv1.2",
  maxVersion: "TLSv1.2"
});

export async function networkReady() {
  try {
    await dns.resolve("google.com");
    return true;
  } catch {
    return false;
  }
}
