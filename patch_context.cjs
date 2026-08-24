const fs = require('fs');
let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

// replace 'projects' with 'home'
content = content.replace(/'map' \| 'layers' \| 'tracks' \| 'projects' \| 'team' \| 'reports' \| 'analytics' \| 'offline'/g, 
  "'home' | 'map' | 'pdf_maps' | 'layers' | 'tracks' | 'team' | 'reports' | 'analytics' | 'offline'");

content = content.replace(/'projects'\);/, "'home');");

// Let's add PDF state
content = content.replace("export interface AppContextType {", "export interface AppContextType {\n  pdfFiles: { id: string, name: string, dataUrl: string }[];\n  addPdfFile: (pdf: { id: string, name: string, dataUrl: string }) => void;");

content = content.replace("const t = translations[language]", "const [pdfFiles, setPdfFiles] = useState<{ id: string, name: string, dataUrl: string }[]>([]);\n  const addPdfFile = (pdf: { id: string, name: string, dataUrl: string }) => setPdfFiles(prev => [...prev, pdf]);\n  const t = translations[language]");

content = content.replace("value={{", "value={{\n        pdfFiles,\n        addPdfFile,");

fs.writeFileSync('src/context/AppContext.tsx', content);
