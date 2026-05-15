// Migration script: remap old assignment subject slugs to new semester slugs
// Usage: set MONGODB_URI in environment, then run: node scripts/migrate_subject_slugs.js

const mongoose = require('mongoose');
const Assignment = require('../src/assignmentModel');

const MAPPING = {
  // theory
  'dms': 'information-theory-coding',
  'dccn': 'wireless-communication',
  'microprocessor': 'operating-system',
  'dbms': 'compiler-design',
  'toc': 'analysis-of-algorithms',
  // labs
  'microprocessor-lab': 'compiler-design-lab',
  'dbms-lab': 'advance-java-lab',
  'network-lab': 'analysis-of-algorithms-lab',
  'linux-lab': 'computer-graphics-multimedia-lab',
  'java-lab': 'advance-java-lab',
};

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Export it and re-run this script.');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  try {
    const keys = Object.keys(MAPPING);
    for (const oldSlug of keys) {
      const newSlug = MAPPING[oldSlug];
      const res = await Assignment.updateMany({ subjectSlug: oldSlug }, { $set: { subjectSlug: newSlug } });
      console.log(`Updated ${res.modifiedCount || res.nModified || res.matchedCount} documents: ${oldSlug} -> ${newSlug}`);
    }

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
