import mysql from "mysql2/promise";
import { config } from "./config";

// A shared connection pool, not a connection-per-request -- mysql2 queues callers past
// the pool's own connection limit rather than piling up raw TCP connections to MariaDB.
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
});
