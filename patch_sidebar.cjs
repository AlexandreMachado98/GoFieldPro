const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Add Home and FileImage to lucide-react imports
content = content.replace("Folder,", "Home,\n  FileImage,\n  Folder,");

const oldTabs = `  const tabs = [
    { id: 'projects', label: t.tabProjects, icon: Folder },
    { id: 'map', label: t.tabMap, icon: Map },
    { id: 'layers', label: t.tabLayers, icon: Layers },
    { id: 'tracks', label: t.tabTracks, icon: Activity },
    { id: 'team', label: t.tabTeam, icon: Users },
    { id: 'reports', label: t.tabReports, icon: FileText },
    { id: 'analytics', label: t.tabAnalytics, icon: BarChart3 },
    { id: 'offline', label: t.tabOffline, icon: HardDrive },
  ];`;

const newTabs = `  const tabs = [
    { id: 'home', label: t.tabHome || 'Início', icon: Home },
    { id: 'pdf_maps', label: t.tabPdfMaps || 'Mapas em PDF', icon: FileImage },
    { id: 'map', label: t.tabMap, icon: Map },
    { id: 'layers', label: t.tabLayers, icon: Layers },
    { id: 'tracks', label: t.tabTracks, icon: Activity },
    { id: 'team', label: t.tabTeam, icon: Users },
    { id: 'reports', label: t.tabReports, icon: FileText },
    { id: 'analytics', label: t.tabAnalytics, icon: BarChart3 },
    { id: 'offline', label: t.tabOffline, icon: HardDrive },
  ];`;

content = content.replace(oldTabs, newTabs);
fs.writeFileSync('src/components/Sidebar.tsx', content);
