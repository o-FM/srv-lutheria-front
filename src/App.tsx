import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { Header } from './components/common/Header';
import { BottomTabBar } from './components/common/BottomTabBar';
import { ToastContainer } from './components/common/ToastContainer';
import { CameraModal } from './components/common/CameraModal';
import { BarcodeScannerModal } from './components/common/BarcodeScannerModal';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { WorkbenchModeModal } from './components/workbench/WorkbenchModeModal';
import { NewOrderWizardModal } from './components/orders/NewOrderWizardModal';
import { OrderDetailSheet } from './components/orders/OrderDetailSheet';
import { HomeModule } from './components/home/HomeModule';
import { OrdersModule } from './components/orders/OrdersModule';
import { ClientsModule } from './components/clients/ClientsModule';
import { StockModule } from './components/stock/StockModule';
import { MoreModule } from './components/more/MoreModule';
import { ClientPortalView } from './components/client-portal/ClientPortalView';
import { ReauthBottomSheet } from './components/auth/ReauthBottomSheet';
import { AccountSettingsModal } from './components/auth/AccountSettingsModal';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { getRolePermissions } from './utils/permissions';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, currentRole, activeOrderId } = useApp();
  const { user } = useAuth();

  // Redirect away from restricted tabs
  React.useEffect(() => {
    if (currentRole === 'atendente' && activeTab === 'estoque') {
      setActiveTab('os');
    }
  }, [currentRole, activeTab, setActiveTab]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans transition-colors">
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 py-4 sm:px-6">
        {currentRole === 'cliente' ? (
          <ClientPortalView />
        ) : (
          <>
            {activeTab === 'hoje' && <HomeModule />}
            {activeTab === 'os' && <OrdersModule />}
            {activeTab === 'clientes' && <ClientsModule />}
            {currentRole === 'luthier' && activeTab === 'estoque' && <StockModule />}
            {activeTab === 'mais' && <MoreModule />}
          </>
        )}
      </main>

      {/* Bottom Tab Bar (Thumb Zone) */}
      <BottomTabBar />

      {/* Global Modals & Sheets */}
      {/* key: abrir outra OS recomeça na aba "Serviços", sem formulários de outra OS */}
      <OrderDetailSheet key={activeOrderId ?? 'none'} />
      <NewOrderWizardModal />
      <WorkbenchModeModal />
      <CameraModal />
      <BarcodeScannerModal />
      <GlobalSearchModal />
      <ToastContainer />
      <ReauthBottomSheet />
      {/* key: os campos da Conta sempre começam com os dados do usuário atual */}
      <AccountSettingsModal key={user?.id ?? 'anon'} />
      <ForgotPasswordModal />
    </div>
  );
};

// Remonta o contexto de dados a cada troca de usuário: o estado em memória de um
// usuário (OS aberta, busca, modais, dados após logout) nunca passa para o próximo.
const AppProviderKeyed: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profileSwitchedTo } = useAuth();
  const switchNotice =
    profileSwitchedTo && profileSwitchedTo.id === user?.id
      ? {
          title: 'Perfil alterado com sucesso',
          description: `Sessão ativa: ${profileSwitchedTo.name} (${getRolePermissions(profileSwitchedTo.role).roleLabel})`,
          type: 'success' as const,
        }
      : null;

  return (
    <AppProvider
      key={user?.id ?? 'anon'}
      initialRole={user?.role ?? 'luthier'}
      isPersistenceEnabled={!!user}
      initialNotice={switchNotice}
      currentUserName={user?.name ?? ''}
    >
      {children}
    </AppProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProviderKeyed>
        <AuthGuard>
          <MainLayout />
        </AuthGuard>
      </AppProviderKeyed>
    </AuthProvider>
  );
}
