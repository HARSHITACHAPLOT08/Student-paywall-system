const { nanoid } = require('nanoid');
const Assignment = require('./assignmentModel');

async function getAllAssignments() {
  const docs = await Assignment.find({}).sort({ uploadedAt: -1 }).lean();
  return docs.map((doc) => ({
    id: doc.id,
    subjectSlug: doc.subjectSlug,
    title: doc.title,
    description: doc.description,
    filename: null,
    originalName: doc.originalName,
    fileType: doc.fileType,
    uploadedAt: doc.uploadedAt ? doc.uploadedAt.getTime() : Date.now(),
    fileUrl: doc.fileUrl,
  }));
}

async function addAssignment({
  subjectSlug,
  title,
  description,
  fileUrl,
  originalName,
  fileType,
}) {
  const id = nanoid();
  const doc = await Assignment.create({
    id,
    subjectSlug,
    title,
    description,
    fileUrl,
    originalName,
    fileType,
    uploadedAt: new Date(),
  });
  return {
    id: doc.id,
    subjectSlug: doc.subjectSlug,
    title: doc.title,
    description: doc.description,
    filename: null,
    originalName: doc.originalName,
    fileType: doc.fileType,
    uploadedAt: doc.uploadedAt.getTime(),
    fileUrl: doc.fileUrl,
  };
}

async function deleteAssignment(id) {
  const doc = await Assignment.findOneAndDelete({ id }).lean();
  if (!doc) return null;
  return {
    id: doc.id,
    subjectSlug: doc.subjectSlug,
    title: doc.title,
    description: doc.description,
    filename: null,
    originalName: doc.originalName,
    fileType: doc.fileType,
    uploadedAt: doc.uploadedAt ? doc.uploadedAt.getTime() : Date.now(),
    fileUrl: doc.fileUrl,
  };
}

async function updateAssignmentFile(id, { filename, originalName, fileType }) {
  const doc = await Assignment.findOneAndUpdate(
    { id },
    {
      originalName,
      fileType,
      uploadedAt: new Date(),
    },
    { new: true }
  ).lean();
  if (!doc) return null;
  return {
    id: doc.id,
    subjectSlug: doc.subjectSlug,
    title: doc.title,
    description: doc.description,
    filename: null,
    originalName: doc.originalName,
    fileType: doc.fileType,
    uploadedAt: doc.uploadedAt ? doc.uploadedAt.getTime() : Date.now(),
    fileUrl: doc.fileUrl,
  };
}

async function getAssignmentById(id) {
  const doc = await Assignment.findOne({ id }).lean();
  if (!doc) return null;
  return {
    id: doc.id,
    subjectSlug: doc.subjectSlug,
    title: doc.title,
    description: doc.description,
    filename: null,
    originalName: doc.originalName,
    fileType: doc.fileType,
    uploadedAt: doc.uploadedAt ? doc.uploadedAt.getTime() : Date.now(),
    fileUrl: doc.fileUrl,
  };
}

module.exports = {
  getAllAssignments,
  addAssignment,
  deleteAssignment,
  updateAssignmentFile,
  getAssignmentById,
};
