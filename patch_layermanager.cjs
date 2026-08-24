const fs = require('fs');
let content = fs.readFileSync('src/components/Layers/LayerManagerModal.tsx', 'utf8');

// The activeSubTab is 'layers' | 'import_pdf' | 'import_kml' | 'basemap'
// Let's replace 'import_pdf' from the Type, or just remove the UI buttons.
content = content.replace("onClick={() => setActiveSubTab('import_pdf')}", "className=\"hidden\"");
content = content.replace("{t.uploadPdfMap}", "");

fs.writeFileSync('src/components/Layers/LayerManagerModal.tsx', content);
