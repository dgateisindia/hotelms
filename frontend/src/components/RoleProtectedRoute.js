import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // adjust to wherever your user/role state lives

/*const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default RoleProtectedRoute;*/