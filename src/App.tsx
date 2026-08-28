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
import { FireIncidentsPanel } from './components/FireIncidents/FireIncidentsPanel';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';
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
import { PlanUpgradeModal } from './components/Billing/PlanUpgradeModal';
import { Sparkles, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { getUserRawItem } from './utils/userStorage';

const MainAppContent: React.FC = () => {
  const {
    activeTab,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isWoodpileModalOpen,
    setIsWoodpileModalOpen,
    isPoliciesModalOpen,
    setIsPoliciesModalOpen,
    openUpgradeModal,
  } = useApp();
  const { profile } = useAuth();

  return (
    <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 text-slate-100 font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden h-full">
        <Topbar />

        {/* Trial Status Notification Banner */}
        {(() => {
          if (!profile || profile.role === 'super_admin' || profile.email?.toLowerCase() === 'alexandre1604981@gmail.com') {
            return null;
          }

          const isTrial = profile.status === 'trial' || profile.subscriptionPlan === 'free_trial' || (profile as any).subscriptionStatus === 'trial';
          if (!isTrial || !profile.subscriptionExpiresAt) return null;

          const expTime = new Date(profile.subscriptionExpiresAt).getTime();
          const diffDays = Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24));

          // Only notify when 4 days or less remain, or if expired
          if (diffDays > 4) return null;

          const isExpired = diffDays <= 0;

          return (
            <div className={`px-3 py-2 sm:px-4 text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-2 border-b shadow-md shrink-0 animate-in fade-in ${
              isExpired
                ? 'bg-rose-950/90 border-rose-800 text-rose-200'
                : 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-center gap-2 text-center sm:text-left">
                {isExpired ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  {isExpired ? (
                    <><b>Seu período de teste de 14 dias expirou.</b> Renove sua assinatura para continuar usando todos os recursos Pro!</>
                  ) : (
                    <><b>Período de Teste Grátis:</b> Restam <span className="underline font-black text-amber-300">{diffDays} {diffDays === 1 ? 'dia' : 'dias'}</span> de acesso Pro ilimitado.</>
                  )}
                </span>
              </div>

              <button
                onClick={() => openUpgradeModal(isExpired ? 'Renovação de Assinatura' : 'Assinatura Plano Pro')}
                className={`px-3 py-1 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer shrink-0 ${
                  isExpired
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                    : 'bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isExpired ? 'Renovar Assinatura' : 'Garantir Plano Pro'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })()}

        {/* Main View Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col h-full pb-14 md:pb-0">
          {(activeTab === 'map' || activeTab === 'layers') && (
            <div className="relative flex-1 flex flex-col w-full h-full">
              <MapViewer />
              <NavigationHUD />
              {activeTab === 'layers' && <LayerManagerModal />}
            </div>
          )}
          {activeTab === 'field_rounds' && <FieldRoundsPanel />}
          {activeTab === 'fire_incidents' && <FireIncidentsPanel />}
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
      <PlanUpgradeModal />
      <ToastContainer />
      <MobileBottomNav />
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { user, profile } = useAuth();
  const [showCelebration, setShowCelebration] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (profile && profile.role !== 'super_admin' && profile.status === 'active') {
      const acknowledged = getUserRawItem(profile.uid, 'approved_acknowledged', '');
      if (acknowledged !== 'true') {
        setShowCelebration(true);
      }
    }
  }, [profile?.status, profile?.uid, profile?.role]);

  // If the user's account is pending approval or blocked (and not the owner super_admin)
  if (profile && profile.role !== 'super_admin' && (profile.status === 'pending' || profile.status === 'blocked')) {
    return <PendingApprovalScreen />;
  }

  // If newly approved, display the celebration transition screen
  if (showCelebration && profile && profile.status === 'active' && profile.role !== 'super_admin') {
    return <ApprovalCelebrationScreen onContinue={() => setShowCelebration(false)} />;
  }

  if (!user || !profile) {
    return null;
  }

  // Strict session lifecycle boundary: key={user.uid} forces full mount/unmount and zero in-memory cross-talk
  return (
    <AppProvider key={user.uid}>
      <UpdateProvider>
        <MainAppContent />
      </UpdateProvider>
    </AppProvider>
  );
};

const RootRouter: React.FC = () => {
  const { user, profile, loading } = useAuth();

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

  return <AuthenticatedApp key={user.uid} />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
