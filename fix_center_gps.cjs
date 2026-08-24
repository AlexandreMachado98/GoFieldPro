const fs = require('fs');
let mapViewer = fs.readFileSync('src/components/Map/MapViewer.tsx', 'utf8');
mapViewer = mapViewer.replace('const centerOnGps = () => {\n    if (!mapInstanceRef.current) return;\n    mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], 16, { duration: 1.2 });\n  };', 'const centerOnGps = () => {\n    if (!mapInstanceRef.current || !hasGpsLock) return;\n    mapInstanceRef.current.flyTo([currentGps.lat, currentGps.lng], 16, { duration: 1.2 });\n  };');
fs.writeFileSync('src/components/Map/MapViewer.tsx', mapViewer);
