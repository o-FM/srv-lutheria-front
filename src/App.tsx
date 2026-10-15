import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
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

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, currentRole } = useApp();

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
      <OrderDetailSheet />
      <NewOrderWizardModal />
      <WorkbenchModeModal />
      <CameraModal />
      <BarcodeScannerModal />
      <GlobalSearchModal />
      <ToastContainer />
      <ReauthBottomSheet />
      <AccountSettingsModal />
      <ForgotPasswordModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AuthGuard>
          <MainLayout />
        </AuthGuard>
      </AppProvider>
    </AuthProvider>
  );
}
