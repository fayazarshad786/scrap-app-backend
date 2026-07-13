const mysql = require('mysql2');
require('dotenv').config();

// Prioritize Railway system variables, fall back to .env values for local dev
const dbHost = process.env.MYSQLHOST || process.env.DB_HOST;
const dbUser = process.env.MYSQLUSER || process.env.DB_USER;
const dbPassword = process.env.MYSQLPASSWORD || process.env.DB_PASS;
const dbDatabase = process.env.MYSQLDATABASE || process.env.DB_NAME;
const rawPort = process.env.MYSQLPORT || process.env.DB_PORT;
const dbPort = rawPort ? parseInt(rawPort, 10) : 3306;

const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 
});

const promisePool = pool.promise();

promisePool.getConnection()
    .then(connection => {
        console.log('🚀 Database connected successfully to Railway MySQL instance!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ CRITICAL DATABASE CONNECTION ERROR:', err.message);
    });

module.exports = promisePool;