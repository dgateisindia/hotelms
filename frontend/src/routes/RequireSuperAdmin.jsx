// src/routes/RequireSuperAdmin.jsx
import { Navigate } from "react-router-dom";
import { useUserRole } from "../hooks/useUserRole";

function RequireSuperAdmin({ children }) {
  const { role, loading } = useUserRole();

  if (loading) return <div>Loading...</div>;
  if (role !== "super_admin") return <Navigate to="/login" replace />;

  return children;
}

export default RequireSuperAdmin;