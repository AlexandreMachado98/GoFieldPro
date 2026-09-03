const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src/components'));

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  
  // If the file exports a Modal and returns <div className="fixed inset-0 ...
  // we want to wrap that root element in createPortal(..., document.body)
  
  if (code.includes('className="fixed inset-0 z-') || code.includes('className="fixed inset-0 bg-')) {
    if (!code.includes('createPortal')) {
      // Find the main return statement of the component
      // This is risky with regex. Let's do it manually for known modals.
      
      const isModal = file.includes('Modal') || file.includes('Drawer') || file.includes('Panel') || file.includes('BottomSheet');
      
      if (isModal) {
        console.log('Fixing modal:', path.basename(file));
        
        // Add import { createPortal } from 'react-dom'; if not exists
        if (!code.includes("import { createPortal }")) {
          code = code.replace(/import React[^;]*;/, "$&\nimport { createPortal } from 'react-dom';");
        }
        
        // Find: return ( \n <div className="fixed inset-0
        // Or: return (\n    <div className="fixed inset-0
        // Or: return <div className="fixed inset-0
        
        // Using a simple regex to wrap the outermost <div className="fixed inset-0 ... > ... </div>
        // Actually, it's safer to just wrap the JSX after `return (` if it starts with `<div className="fixed inset-0`
        
        code = code.replace(/return\s*\(\s*(<div[^>]*className=["'][^"']*fixed inset-0[^"']*["'][^>]*>[\s\S]*?<\/div>)\s*\);/g, (match, p1) => {
          return `return createPortal(\n    ${p1},\n    document.body\n  );`;
        });
        
        fs.writeFileSync(file, code);
      }
    }
  }
});
console.log('Done patching modals');
