const fs = require('fs');
let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

content = content.replace(
  "{ id: string, name: string, dataUrl: string }[]",
  "{ id: string, name: string, dataUrl: string, width?: number, height?: number }[]"
);
content = content.replace(
  "(pdf: { id: string, name: string, dataUrl: string })",
  "(pdf: { id: string, name: string, dataUrl: string, width?: number, height?: number })"
);
content = content.replace(
  "{ id: string, name: string, dataUrl: string }[]",
  "{ id: string, name: string, dataUrl: string, width?: number, height?: number }[]"
);
content = content.replace(
  "(pdf: { id: string, name: string, dataUrl: string })",
  "(pdf: { id: string, name: string, dataUrl: string, width?: number, height?: number })"
);

fs.writeFileSync('src/context/AppContext.tsx', content);
