import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { UpdateProvider } from './context/UpdateContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MapViewer } from './components/Map/MapViewer';
import { NavigationHUD } from './components/Navigation/NavigationHUD';
import { PdfMapNavigator } from './components/PdfMaps/PdfMapNavigator';
import { FieldRoundsPanel } from './components/FieldRounds/FieldRoundsPanel';
import { FireIncidentsPanel } from './components/FireIncidents/FireIncidentsPanel';
import { HomeDashboard } from './components/Home/HomeDashboard';
import { OfflineSyncDrawer } from './components/Offline/OfflineSyncDrawer';
import { AdminPanel } from './components/Admin/AdminPanel';
import { SettingsModal } from './components/Settings/SettingsModal';
import { WoodpileCubageModal } from './components/Forestry/WoodpileCubageModal';
import { LegalPoliciesModal } from './components/Legal/LegalPoliciesModal';
import { LoginScreen } from './components/Auth/LoginScreen';
import { PendingApprovalScreen } from './components/Auth/PendingApprovalScreen';
import { ApprovalCelebrationScreen } from './components/Auth/ApprovalCelebrationScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmModal } from './components/Common/ConfirmModal';
import { ToastContainer } from './components/Common/ToastContainer';
import { FeatureLockModal } from './components/Common/FeatureLockModal';
import { AddWaypointModal } from './components/Waypoints/AddWaypointModal';
import { LayerManagerModal } from './components/Layers/LayerManagerModal';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';
import { AppUpdateBanner } from './components/Common/AppUpdateBanner';
import { SpecialAccessModal } from './components/Modals/SpecialAccessModal';
import { Sparkles, Clock, AlertTriangle, ArrowRight, Lock, ExternalLink } from 'lucide-react';
import { getUserRawItem } from './utils/userStorage';

const FeatureRestrictedView: React.FC<{ featureName: string }> = ({ featureName }) => {
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md text-center shadow-2xl space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">Recurso Exclusivo GoField Pro</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            O recurso <strong className="text-white">"{featureName}"</strong> faz parte do plano profissional do GoField Pro.
          </p>
        </div>
        <a
          href="https://amtst.vercel.app/#apps"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all"
        >
          <span>Conhecer o GoField Pro na AM TST</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};

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
    hasFeatureAccess,
  } = useApp();
  const { profile } = useAuth();

  // Show Welcome / Plan Choice modal on first login if not yet dismissed
  React.useEffect(() => {
    if (!profile || profile.role === 'super_admin' || profile.email?.toLowerCase() === 'alexandre1604981@gmail.com') {
      return;
    }
    const isDismissed = localStorage.getItem(`gofield_welcome_dismissed_${profile.uid}`) === 'true';
    if (!profile.hasChosenPlan && !isDismissed) {
      const timer = setTimeout(() => {
        openUpgradeModal();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [profile?.uid, profile?.hasChosenPlan, profile?.role, openUpgradeModal]);

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
                    <><b>Atenção:</b> Seu período de teste gratuito expira em <b>{diffDays} {diffDays === 1 ? 'dia' : 'dias'}</b>.</>
                  )}
                </span>
              </div>

              <button
                onClick={() => openUpgradeModal('Assinatura GoField Pro')}
                className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isExpired ? 'Assinar Agora' : 'Ativar Plano Oficial'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })()}

        {/* Main View Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col h-full pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {(activeTab === 'map' || activeTab === 'layers') && (
            <div className="relative flex-1 flex flex-col w-full h-full">
              <MapViewer />
              <NavigationHUD />
              {activeTab === 'layers' && <LayerManagerModal />}
            </div>
          )}
          {activeTab === 'field_rounds' && (
            hasFeatureAccess('field_rounds') ? (
              <FieldRoundsPanel />
            ) : (
              <FeatureRestrictedView featureName="Rondas & Inspeções de Campo SST" />
            )
          )}
          {activeTab === 'fire_incidents' && (
            hasFeatureAccess('fire_incidents') ? (
              <FireIncidentsPanel />
            ) : (
              <FeatureRestrictedView featureName="Registro de Focos de Incêndio & Ocorrências" />
            )
          )}
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
      <SpecialAccessModal onOpenUpgradeModal={() => openUpgradeModal('Acesso Premium')} />
      <AddWaypointModal />
      <LayerManagerModal />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      <WoodpileCubageModal isOpen={isWoodpileModalOpen} onClose={() => setIsWoodpileModalOpen(false)} />
      <LegalPoliciesModal isOpen={isPoliciesModalOpen} onClose={() => setIsPoliciesModalOpen(false)} />
      <ConfirmModal />
      <FeatureLockModal />
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

  // If the user's account is specifically blocked by admin
  if (profile && profile.role !== 'super_admin' && profile.status === 'blocked') {
    return <PendingApprovalScreen />;
  }

  // If newly approved, display celebration screen
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
