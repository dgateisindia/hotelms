import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from '../services/axiosInstance';

function ProtectedRoute({ children, allowedRoles }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [status, setStatus] = useState('loading');
  const [dbUser, setDbUser] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setStatus('unauth'); return; }

    (async () => {
      try {
        const token = await getToken();
        const res = await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDbUser(res.data.user);
        setStatus(allowedRoles.includes(res.data.user.role) ? 'ok' : 'denied');
      } catch {
        setStatus('unauth');
      }
    })();
  }, [isLoaded, isSignedIn]);

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'unauth') return <Navigate to="/login" replace />;
  if (status === 'denied') return <Navigate to="/unauthorized" replace />;
  if (dbUser?.mustChangePassword) return <Navigate to="/change-password" replace />;

  return children;
}

export default ProtectedRoute;