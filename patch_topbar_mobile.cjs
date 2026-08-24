const fs = require('fs');
let content = fs.readFileSync('src/components/Topbar.tsx', 'utf8');

// Add lucide Menu icon
content = content.replace("Folder,\n  Wifi,", "Folder,\n  Wifi,\n  Menu,");

// Use AppContext
content = content.replace("markNotificationAsRead,\n  } = useApp();", "markNotificationAsRead,\n    setIsMobileMenuOpen,\n  } = useApp();");

// Add Hamburger menu before project dropdown
const oldHeader = `<div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 h-14">
        {/* Left Side: Project Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">`;
          
const newHeader = `<div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 h-14">
        {/* Left Side: Project Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            className="md:hidden p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="relative">`;

content = content.replace(oldHeader, newHeader);

// Reduce max-width on mobile of the title
content = content.replace('max-w-[140px] sm:max-w-[300px]', 'max-w-[100px] sm:max-w-[300px]');

fs.writeFileSync('src/components/Topbar.tsx', content);
