const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const { getDataFile } = require('./storage');

const DATA_FILE = getDataFile('assignments.json');

function ensureStore() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ assignments: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function getAllAssignments() {
  const data = readStore();
  return data.assignments || [];
}

async function addAssignment({
  subjectSlug,
  title,
  description,
  filename,
  originalName,
  fileType,
}) {
  const data = readStore();
  const assignment = {
    id: nanoid(),
    subjectSlug,
    title,
    description,
    filename,
    originalName,
    fileType, // 'image' or 'pdf'
    uploadedAt: Date.now(),
  };
  data.assignments.push(assignment);
  writeStore(data);
  return assignment;
}

async function deleteAssignment(id) {
  const data = readStore();
  const index = data.assignments.findIndex((a) => a.id === id);
  if (index === -1) return null;
  const [removed] = data.assignments.splice(index, 1);
  writeStore(data);
  return removed;
}

async function updateAssignmentFile(id, { filename, originalName, fileType }) {
  const data = readStore();
  const assignment = data.assignments.find((a) => a.id === id);
  if (!assignment) return null;
  assignment.filename = filename;
  assignment.originalName = originalName;
  assignment.fileType = fileType;
  assignment.uploadedAt = Date.now();
  writeStore(data);
  return assignment;
}

async function getAssignmentById(id) {
  const data = readStore();
  return data.assignments.find((a) => a.id === id) || null;
}

module.exports = {
  getAllAssignments,
  addAssignment,
  deleteAssignment,
  updateAssignmentFile,
  getAssignmentById,
};
