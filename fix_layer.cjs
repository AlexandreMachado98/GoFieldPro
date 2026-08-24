const fs = require('fs');
let content = fs.readFileSync('src/components/Layers/LayerManagerModal.tsx', 'utf8');

content = content.replace(
  'id="tab-import-pdf"\n                className="hidden"\n                className=',
  'id="tab-import-pdf"\n                className="hidden"\n                data-old-class='
);

fs.writeFileSync('src/components/Layers/LayerManagerModal.tsx', content);
