import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout      from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import StoreList    from './pages/StoreList';
import StoreDetail  from './pages/StoreDetail';
import DeliveryList from './pages/DeliveryList';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/livraisons"
        element={
          <PrivateRoute>
            <Layout>
              <DeliveryList />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/enseignes"
        element={
          <PrivateRoute>
            <Layout>
              <StoreList />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/enseignes/:id"
        element={
          <PrivateRoute>
            <Layout>
              <StoreDetail />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
