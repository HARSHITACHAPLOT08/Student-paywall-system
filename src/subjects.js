const SUBJECTS = [
  { slug: 'information-theory-coding', name: 'Information Theory & Coding', type: 'theory' },
  { slug: 'compiler-design', name: 'Compiler Design', type: 'theory' },
  { slug: 'operating-system', name: 'Operating System', type: 'theory' },
  { slug: 'computer-graphics-multimedia', name: 'Computer Graphics & Multimedia', type: 'theory' },
  { slug: 'analysis-of-algorithms', name: 'Analysis of Algorithms', type: 'theory' },
  { slug: 'wireless-communication', name: 'Wireless Communication', type: 'theory' },
  { slug: 'human-computer-interaction', name: 'Human Computer Interaction', type: 'theory' },

  { slug: 'compiler-design-lab', name: 'Compiler Design Lab', type: 'lab' },
  { slug: 'advance-java-lab', name: 'Advance Java Lab', type: 'lab' },
  { slug: 'computer-graphics-multimedia-lab', name: 'Computer Graphics & Multimedia Lab', type: 'lab' },
  { slug: 'analysis-of-algorithms-lab', name: 'Analysis of Algorithms Lab', type: 'lab' },
];

const THEORY_SUBJECTS = SUBJECTS.filter((s) => s.type === 'theory');
const LAB_SUBJECTS = SUBJECTS.filter((s) => s.type === 'lab');

module.exports = { SUBJECTS, THEORY_SUBJECTS, LAB_SUBJECTS };
