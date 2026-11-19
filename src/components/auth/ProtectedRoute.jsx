
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [authStatus, setAuthStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const apiBaseUrl = (
          import.meta.env.VITE_API_URL ?? ""
        ).replace(/\/$/, "");

        const response = await fetch(
          `${apiBaseUrl}/api/auth/refresh`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!isMounted) return;

        setAuthStatus(response.ok ? "authenticated" : "unauthenticated");
      } catch (error) {
        console.error("Session verification failed:", error);

        if (isMounted) {
          setAuthStatus("unauthenticated");
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authStatus === "checking") {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Verifying your session...</p>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
