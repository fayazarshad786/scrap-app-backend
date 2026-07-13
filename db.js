const mysql = require('mysql2');
require('dotenv').config();

// Reformat port cleanly to ensure it is passed as a pure number to mysql2
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: dbPort,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 // Prevents the app from hanging forever if DB is slow to respond
});

// Export the promise-based wrapper
const promisePool = pool.promise();

// Test the connection immediately on startup to catch explicit errors in the logs
promisePool.getConnection()
    .then(connection => {
        console.log('🚀 Database connected successfully to Railway MySQL instance!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ CRITICAL DATABASE CONNECTION ERROR:', err.message);
    });

module.exports = promisePool;