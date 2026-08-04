// src/components/PostLoginRedirect.jsx
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

function PostLoginRedirect() {
  const { getToken, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;

    (async () => {
      const token = await getToken();
      const res = await fetch("http://localhost:5000/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!data.success) {
        navigate("/login");
        return;
      }

      const role = data.user.role;
      if (role === "super_admin") navigate("/superadmin-dashboard");
      else if (role === "admin") navigate("/admin-dashboard");
      else navigate("/dashboard"); // staff roles etc.

      setLoading(false);
    })();
  }, [isSignedIn]);

  return loading ? <div>Loading...</div> : null;
}

export default PostLoginRedirect;