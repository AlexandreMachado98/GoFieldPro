const fs = require('fs');

// AppContext.tsx
let context = fs.readFileSync('src/context/AppContext.tsx', 'utf8');
context = context.replace('isGpsSimulated: boolean;', 'isGpsSimulated: boolean;\n  hasGpsLock: boolean;');
context = context.replace('const [isGpsSimulated, setIsGpsSimulated] = useState<boolean>(false);', 'const [isGpsSimulated, setIsGpsSimulated] = useState<boolean>(false);\n  const [hasGpsLock, setHasGpsLock] = useState<boolean>(false);');
context = context.replace('timestamp: Date.now(),\n          });', 'timestamp: Date.now(),\n          });\n          setHasGpsLock(true);');
context = context.replace('isGpsSimulated,\n    radioMessages', 'isGpsSimulated,\n    hasGpsLock,\n    radioMessages');
fs.writeFileSync('src/context/AppContext.tsx', context);

// MapViewer.tsx
let mapViewer = fs.readFileSync('src/components/Map/MapViewer.tsx', 'utf8');
mapViewer = mapViewer.replace('currentGps,\n    teamMembers,', 'currentGps,\n    hasGpsLock,\n    teamMembers,');
mapViewer = mapViewer.replace('// Update Live GPS User Marker\n  useEffect(() => {\n    if (!mapInstanceRef.current) return;', '// Update Live GPS User Marker\n  useEffect(() => {\n    if (!mapInstanceRef.current || !hasGpsLock) return;');
fs.writeFileSync('src/components/Map/MapViewer.tsx', mapViewer);
