const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace("import { ProjectFolderManager } from './components/Projects/ProjectFolderManager';", "import { HomeDashboard } from './components/Home/HomeDashboard';\nimport { PdfMapNavigator } from './components/PdfMaps/PdfMapNavigator';");

content = content.replace("{activeTab === 'projects' && <ProjectFolderManager />}", "{activeTab === 'home' && <HomeDashboard />}\n          {activeTab === 'pdf_maps' && <PdfMapNavigator />}");

fs.writeFileSync('src/App.tsx', content);
