// db.js
const dns = require("dns");
const { Pool } = require("pg");
require("dotenv").config();

// Prefer IPv4 address resolution when possible (helps in environments without IPv6 routing)
if (typeof dns.setDefaultResultOrder === "function") {
  try {
    dns.setDefaultResultOrder("ipv4first");
    console.log("DNS result order set to ipv4first");
  } catch (e) {
    // ignore if not supported
  }
}

const rawDbUrl = process.env.DATABASE_URL;
const sslConfig =
  process.env.NODE_ENV === "production" || !!rawDbUrl ? { rejectUnauthorized: false } : false;

const poolPromise = (async () => {
  if (!rawDbUrl) {
    return new Pool({
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
    });
  }

  try {
    const url = new URL(rawDbUrl);
    const hostname = url.hostname;

    let host = hostname;
    try {
      const lookup = await dns.promises.lookup(hostname, { family: 4 });
      host = lookup.address;
      console.log(`IPv4 resolved for DB host: ${hostname} -> ${host}`);
    } catch (e) {
      console.log(`IPv4 lookup failed for DB host: ${hostname}, using hostname`);
    }

    return new Pool({
      user: decodeURIComponent(url.username || ""),
      password: decodeURIComponent(url.password || ""),
      host,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname.replace(/^\//, ""),
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
    });
  } catch (e) {
    console.log("DATABASE_URL parse failed, falling back to connectionString");
    return new Pool({
      connectionString: rawDbUrl,
      ssl: sslConfig,
      connectionTimeoutMillis: 10000,
    });
  }
})();

poolPromise
  .then((pool) => pool.connect())
  .then(() => console.log("PostgreSQL Connected"))
  .catch((err) => console.error("DB Connection Error", err));

const db = {
  query: async (...args) => {
    const pool = await poolPromise;
    return pool.query(...args);
  },
  end: async (...args) => {
    const pool = await poolPromise;
    return pool.end(...args);
  },
};

module.exports = db;
