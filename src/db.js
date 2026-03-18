const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assignment_vault';

let isConnected = false;

async function connectToDatabase() {
  if (isConnected) return mongoose.connection;

  mongoose.set('strictQuery', true);

  await mongoose.connect(MONGODB_URI, {
    dbName: undefined,
  });

  isConnected = true;
  return mongoose.connection;
}

module.exports = { connectToDatabase };
