const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Just rewrite MainAppContent completely
const newMainContent = `const MainAppContent: React.FC = () => {
  const { activeTab } = useApp();
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        
        {/* Main View Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {activeTab === 'map' && (
            <>
              <MapViewer />
              <NavigationHUD />
            </>
          )}
          {activeTab === 'layers' && (
            <div className="relative flex-1 flex flex-col">
              <MapViewer />
              <LayerManagerModal />
            </div>
          )}
          {activeTab === 'tracks' && <TrackRecorderPanel />}
          {activeTab === 'projects' && <ProjectFolderManager />}
          {activeTab === 'team' && <TeamTelemetryPanel />}
          {activeTab === 'reports' && <ReportGeneratorModal />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'offline' && <OfflineSyncDrawer />}
          {activeTab === 'admin' && <AdminPanel />}
        </main>
      </div>

      {/* Global Modals */}
      <AddWaypointModal />
      <LayerManagerModal />
      <FieldAIAssistantModal />
    </div>
  );
};`;

content = content.replace(/const MainAppContent: React\.FC = \(\) => \{[\s\S]*?\};\n\nexport default function App\(\)/, newMainContent + '\n\nexport default function App()');
fs.writeFileSync('src/App.tsx', content);
