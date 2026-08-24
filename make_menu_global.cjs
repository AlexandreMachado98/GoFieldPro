const fs = require('fs');

// Topbar.tsx
let topbar = fs.readFileSync('src/components/Topbar.tsx', 'utf8');
topbar = topbar.replace(
  'className="md:hidden p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"',
  'className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"'
);
fs.writeFileSync('src/components/Topbar.tsx', topbar);

// Sidebar.tsx
let sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(
  '} md:relative md:translate-x-0 md:flex md:shrink-0`}',
  '}`}'
);
sidebar = sidebar.replace(
  'className="fixed inset-0 bg-black/60 md:hidden -z-10"',
  'className="fixed inset-0 bg-black/60 -z-10"'
);
sidebar = sidebar.replace(
  'className="md:hidden p-1 text-slate-400 hover:text-slate-200"',
  'className="p-1 text-slate-400 hover:text-slate-200"'
);
fs.writeFileSync('src/components/Sidebar.tsx', sidebar);
