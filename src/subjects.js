const SUBJECTS = [
  { slug: 'dms', name: 'Discrete Mathematics Structure', type: 'theory' },
  { slug: 'dccn', name: 'Data Communication and Computer Networks', type: 'theory' },
  { slug: 'microprocessor', name: 'Microprocessor and Interfaces', type: 'theory' },
  { slug: 'dbms', name: 'DBMS', type: 'theory' },
  { slug: 'toc', name: 'Theory of Computation', type: 'theory' },
  { slug: 'microprocessor-lab', name: 'Microprocessor and Interfaces Lab', type: 'lab' },
  { slug: 'dbms-lab', name: 'DBMS Lab', type: 'lab' },
  { slug: 'network-lab', name: 'Network Programming Lab', type: 'lab' },
  { slug: 'linux-lab', name: 'Linux Shell Programming Lab', type: 'lab' },
  { slug: 'java-lab', name: 'Java Lab', type: 'lab' },
];

const THEORY_SUBJECTS = SUBJECTS.filter((s) => s.type === 'theory');
const LAB_SUBJECTS = SUBJECTS.filter((s) => s.type === 'lab');

module.exports = { SUBJECTS, THEORY_SUBJECTS, LAB_SUBJECTS };
