import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="bg-gradient-main min-h-screen flex items-center justify-center">
        <div className="text-foreground font-assistant text-lg animate-pulse">טוען...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/admin-login" replace />;
  }

  if (!profile.active) {
    return <Navigate to="/admin-login" replace />;
  }

  if (profile.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  console.log("[ProtectedRoute] Checking access for role:", profile?.role, "requiredRole:", requiredRole);

  if (requiredRole && profile.role !== requiredRole && profile.role !== "creator") {
    return <Navigate to="/admin" replace />;
  }

  if (!requiredRole && profile.role === "commander") {
    return <Navigate to="/commander" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
