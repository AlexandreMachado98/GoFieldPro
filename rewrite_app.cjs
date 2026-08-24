const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace("import { Navbar } from './components/Navbar';", "import { Sidebar } from './components/Sidebar';\nimport { Topbar } from './components/Topbar';");
content = content.replace('<div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">', '<div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">');
content = content.replace('{/* Top Application Bar */}\n      <Navbar />', '<Sidebar />\n      <div className="flex flex-col flex-1 overflow-hidden">\n        <Topbar />');
content = content.replace('      </main>\n\n      {/* Global Modals */}', '      </main>\n      </div>\n\n      {/* Global Modals */}');
fs.writeFileSync('src/App.tsx', content);
