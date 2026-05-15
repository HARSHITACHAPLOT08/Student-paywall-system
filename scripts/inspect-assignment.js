require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const Assignment = require('../src/assignmentModel');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const doc = await Assignment.findOne({ id: 'N5o0pTTvwVVael89LFPnB' }).lean();
    fs.writeFileSync('tmp-assignment.json', JSON.stringify(doc, null, 2));
  } catch (error) {
    fs.writeFileSync('tmp-assignment.json', JSON.stringify({ error: error.message }, null, 2));
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
