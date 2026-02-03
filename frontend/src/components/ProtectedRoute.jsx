import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useEffect } from "react";
export default function ProtectedRoute({ children, role }) {
  const { token, user, me } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      me();
    }
  },[token,user,me]);

  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <p>Loading session...</p>;
  
  return children;
}
