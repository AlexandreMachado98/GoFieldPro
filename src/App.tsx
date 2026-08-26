import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UpdateProvider } from './context/UpdateContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MapViewer } from './components/Map/MapViewer';
import { NavigationHUD } from './components/Navigation/NavigationHUD';
import { LayerManagerModal } from './components/Layers/LayerManagerModal';
import { AddWaypointModal } from './components/Waypoints/AddWaypointModal';
import { HomeDashboard } from './components/Home/HomeDashboard';
import { PdfMapNavigator } from './components/PdfMaps/PdfMapNavigator';
import { OfflineSyncDrawer } from './components/Offline/OfflineSyncDrawer';
import { FieldRoundsPanel } from './components/FieldRounds/FieldRoundsPanel';
import { AdminPanel } from './components/Admin/AdminPanel';
import { LoginScreen } from './components/Auth/LoginScreen';
import { PendingApprovalScreen } from './components/Auth/PendingApprovalScreen';
import { ApprovalCelebrationScreen } from './components/Auth/ApprovalCelebrationScreen';
import { ToastContainer } from './components/Common/ToastContainer';
import { ConfirmModal } from './components/Common/ConfirmModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { WoodpileCubageModal } from './components/Forestry/WoodpileCubageModal';
import { LegalPoliciesModal } from './components/Legal/LegalPoliciesModal';
import { AppUpdateBanner } from './components/Common/AppUpdateBanner';

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isWoodpileModalOpen,
    setIsWoodpileModalOpen,
    isPoliciesModalOpen,
    setIsPoliciesModalOpen,
  } = useApp();
  const { user, profile, loading } = useAuth();
  const [showCelebration, setShowCelebration] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (profile && profile.role !== 'super_admin' && profile.status === 'active') {
      const acknowledged = localStorage.getItem(`gofield_approved_acknowledged_${profile.uid}`);
      if (acknowledged !== 'true') {
        setShowCelebration(true);
      }
    }
  }, [profile?.status, profile?.uid, profile?.role]);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  // If the user's account is pending approval or blocked (and not the owner super_admin)
  if (profile.role !== 'super_admin' && (profile.status === 'pending' || profile.status === 'blocked')) {
    return <PendingApprovalScreen />;
  }

  // If newly approved, display the celebration transition screen
  if (showCelebration && profile.status === 'active' && profile.role !== 'super_admin') {
    return <ApprovalCelebrationScreen onContinue={() => setShowCelebration(false)} />;
  }

  return (
    <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden h-full">
        <Topbar />
        
        {/* Main View Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col h-full">
          {(activeTab === 'map' || activeTab === 'layers') && (
            <div className="relative flex-1 flex flex-col w-full h-full">
              <MapViewer />
              <NavigationHUD />
              {activeTab === 'layers' && <LayerManagerModal />}
            </div>
          )}
          {activeTab === 'field_rounds' && <FieldRoundsPanel />}
          {activeTab === 'home' && <HomeDashboard />}
          {activeTab === 'pdf_maps' && (
            <ErrorBoundary fallbackTitle="Visualizador de Mapas e Plantas PDF">
              <PdfMapNavigator />
            </ErrorBoundary>
          )}
          {activeTab === 'offline' && <OfflineSyncDrawer />}
          {activeTab === 'admin' && <AdminPanel />}
        </main>
      </div>

      {/* Global Modals, Notifications & Auto-Update Banner */}
      <AppUpdateBanner />
      <AddWaypointModal />
      <LayerManagerModal />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      <WoodpileCubageModal isOpen={isWoodpileModalOpen} onClose={() => setIsWoodpileModalOpen(false)} />
      <LegalPoliciesModal isOpen={isPoliciesModalOpen} onClose={() => setIsPoliciesModalOpen(false)} />
      <ConfirmModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <UpdateProvider>
            <MainAppContent />
          </UpdateProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

