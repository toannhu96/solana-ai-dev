// AppContent.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DesignPage from './pages/design/DesignPage';
import CodePage from './pages/code/CodePage';
import DocPage from './pages/DocsPage';
import AccountPage from './pages/AccountPage';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import { ProjectProvider } from './contexts/ProjectContext';
import { DocsProvider } from './contexts/DocsContext';
import { CodeFileProvider } from './contexts/CodeFileContext';
import UIPage from './pages/ui/UIPage';

const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/design" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/design" replace /> : <RegisterPage />} />

      {user && (
        <Route>
          <Route
            path="/design"
            element={
              <ProtectedRoute>
                <ProjectProvider>
                  <CodeFileProvider>
                    <DocsProvider>
                      <MainLayout>
                        <DesignPage />
                      </MainLayout>
                    </DocsProvider>
                  </CodeFileProvider>
                </ProjectProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/code"
            element={
              <ProtectedRoute>
                <ProjectProvider>
                  <CodeFileProvider>
                    <DocsProvider>
                      <MainLayout>
                        <CodePage />
                      </MainLayout>
                    </DocsProvider>
                  </CodeFileProvider>
                </ProjectProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ui"
            element={
              <ProtectedRoute>
                <ProjectProvider>
                  <CodeFileProvider>
                    <DocsProvider>
                      <MainLayout>
                        <UIPage />
                      </MainLayout>
                    </DocsProvider>
                  </CodeFileProvider>
                </ProjectProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/doc"
            element={
              <ProtectedRoute>
                <ProjectProvider>
                  <CodeFileProvider>
                    <DocsProvider>
                      <MainLayout>
                        <DocPage />
                      </MainLayout>
                    </DocsProvider>
                  </CodeFileProvider>
                </ProjectProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <ProjectProvider>
                  <CodeFileProvider>
                    <DocsProvider>
                      <MainLayout>
                        <AccountPage />
                      </MainLayout>
                    </DocsProvider>
                  </CodeFileProvider>
                </ProjectProvider>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/design" replace />} />
        </Route>
      )}

      {/* Redirect all unauthenticated users to /login */}
      {!user && <Route path="*" element={<Navigate to="/login" replace />} />}
    </Routes>
  );
};

export default AppContent;
