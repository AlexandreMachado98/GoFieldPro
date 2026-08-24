const fs = require('fs');
let context = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

context = context.replace(
  "setCurrentRole,",
  "setCurrentRole,\n        isMobileMenuOpen,\n        setIsMobileMenuOpen,"
);

fs.writeFileSync('src/context/AppContext.tsx', context);
