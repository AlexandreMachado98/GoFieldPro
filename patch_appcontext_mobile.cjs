const fs = require('fs');
let context = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

// Add to AppContextType
context = context.replace(
  "setActiveTab: (tab: 'map' | 'layers' | 'tracks' | 'projects' | 'team' | 'reports' | 'analytics' | 'offline') => void;",
  "setActiveTab: (tab: 'map' | 'layers' | 'tracks' | 'projects' | 'team' | 'reports' | 'analytics' | 'offline') => void;\n  isMobileMenuOpen: boolean;\n  setIsMobileMenuOpen: (isOpen: boolean) => void;"
);

// Add state to AppProvider
context = context.replace(
  "const [activeTab, setActiveTab] = useState",
  "const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);\n  const [activeTab, setActiveTab] = useState"
);

// Export it in return value
context = context.replace(
  "activeTab,\n    setActiveTab,",
  "activeTab,\n    setActiveTab,\n    isMobileMenuOpen,\n    setIsMobileMenuOpen,"
);

fs.writeFileSync('src/context/AppContext.tsx', context);
