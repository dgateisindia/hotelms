// src/hooks/useUserRole.js
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

export function useUserRole() {
  const { getToken, isSignedIn } = useAuth();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("http://localhost:5000/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.success) {
          setRole(data.user.role);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("useUserRole error:", err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  return { role, loading };
}