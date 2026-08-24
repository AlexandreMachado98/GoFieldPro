const fs = require('fs');
let t = fs.readFileSync('src/i18n/translations.ts', 'utf8');

t = t.replace(/tabProjects: 'Projetos & Pastas',/g, "tabProjects: 'Projetos & Pastas',\n    tabHome: 'Início',\n    tabPdfMaps: 'Navegador de PDFs',");
t = t.replace(/tabProjects: 'Projects & Folders',/g, "tabProjects: 'Projects & Folders',\n    tabHome: 'Home',\n    tabPdfMaps: 'PDF Navigator',");
t = t.replace(/tabProjects: 'Proyectos y Carpetas',/g, "tabProjects: 'Proyectos y Carpetas',\n    tabHome: 'Inicio',\n    tabPdfMaps: 'Navegador PDF',");

fs.writeFileSync('src/i18n/translations.ts', t);
