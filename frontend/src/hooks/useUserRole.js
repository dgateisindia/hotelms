import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

import apiClient from "../shared/api/apiClient";

export function useUserRole() {
  const {
    isLoaded,
    isSignedIn,
    getToken,
  } = useAuth();

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  const refreshRole = useCallback(() => {
    setRefreshKey((currentValue) => currentValue + 1);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadAuthenticatedUser = async () => {
      if (!isLoaded) {
        return;
      }

      if (!isSignedIn) {
        if (isActive) {
          setUser(null);
          setRole(null);
          setError("");
          setLoading(false);
        }

        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await getToken();

        if (!token) {
          throw new Error(
            "Your login session could not be verified. Please sign in again."
          );
        }

        const response = await apiClient.get("/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const authenticatedUser = response.data?.user;

        if (!authenticatedUser?.role) {
          throw new Error(
            "Your account role could not be identified. Please sign in again."
          );
        }

        if (isActive) {
          setUser(authenticatedUser);
          setRole(authenticatedUser.role);
        }
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        const message =
          requestError?.message ||
          "Your account information could not be loaded. Please try again.";

        setUser(null);
        setRole(null);
        setError(message);

        if (process.env.NODE_ENV === "development") {
          console.error(
            `[USER_ROLE] ${
              requestError?.code || "ROLE_FETCH_FAILED"
            }: ${message}`
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadAuthenticatedUser();

    return () => {
      isActive = false;
    };
  }, [
    isLoaded,
    isSignedIn,
    getToken,
    refreshKey,
  ]);

  return {
    user,
    role,
    loading,
    error,
    refreshRole,
  };
}