import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
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
import { AppearanceModal } from './components/settings/AppearanceModal';
import { navItemsFor } from './config/navigation';
import { usePathname } from './hooks/usePathname';
import { CustomerPortalPage } from './pages/CustomerPortalPage';
import { ClientAreaPage } from './pages/ClientAreaPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RegisterWorkshopPage } from './pages/RegisterWorkshopPage';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, currentRole } = useApp();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const isStaff = currentRole !== 'cliente';

  // Aba fora do alcance do papel (ex.: atendente em "Estoque") → primeira aba permitida
  useEffect(() => {
    const allowed = navItemsFor(currentRole);
    if (isStaff && allowed.length && !allowed.some((i) => i.id === activeTab)) {
      setActiveTab(allowed[0].id);
    }
  }, [currentRole, activeTab, setActiveTab, isStaff]);

  return (
    <div className="min-h-dvh bg-base-950 text-base-100">
      {isStaff && <Sidebar onOpenAppearance={() => setAppearanceOpen(true)} />}

      <div className={isStaff ? 'lg:pl-64' : ''}>
        <Header onOpenAppearance={() => setAppearanceOpen(true)} />

        <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8 pb-28 lg:pb-10">
          {!isStaff ? (
            <ClientPortalView />
          ) : (
            <>
              {activeTab === 'hoje' && <HomeModule />}
              {activeTab === 'os' && <OrdersModule />}
              {activeTab === 'clientes' && <ClientsModule />}
              {activeTab === 'estoque' && <StockModule />}
              {activeTab === 'mais' && <MoreModule />}
            </>
          )}
        </main>
      </div>

      <BottomTabBar />

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
      <AppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
    </div>
  );
};

/** Rotas públicas (sem login) vêm antes do AuthGuard. */
const Routes: React.FC = () => {
  const path = usePathname();
  const portal = path.match(/^\/acompanhar\/([A-Za-z0-9_-]+)\/?$/);
  if (portal) return <CustomerPortalPage token={portal[1]} />;
  const clientArea = path.match(/^\/cliente\/([a-z0-9-]+)\/?$/);
  if (clientArea) return <ClientAreaPage workshop={clientArea[1]} />;
  if (path.startsWith('/redefinir-senha')) return <ResetPasswordPage />;
  if (path.startsWith('/cadastro')) return <RegisterWorkshopPage />;
  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppProvider>
          <Routes />
        </AppProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
