/*import { Navigate } from 'react-router-dom';
import { getAccessToken } from '../utils/icons/tokenManager';

function ProtectedRoute({ children, allowedRoles }) {
  const token = getAccessToken();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Not logged in at all
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // If this route restricts by role, and user's role isn't allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;*/

const ProtectedRoute = ({ children }) => {
  return children;
};

export default ProtectedRoute;