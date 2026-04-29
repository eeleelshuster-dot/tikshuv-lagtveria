import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import OpenTicket from "./pages/OpenTicket";
import TrackTicket from "./pages/TrackTicket";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import CommanderDashboard from "./pages/CommanderDashboard";
import CreatorPanel from "./pages/CreatorPanel";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import { ContentProvider } from "@/contexts/ContentContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <ContentProvider>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/open-ticket" element={<OpenTicket />} />
                <Route path="/track-ticket" element={<TrackTicket />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/commander" element={
                  <ProtectedRoute requiredRole="commander">
                    <CommanderDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/creator" element={
                  <ProtectedRoute requiredRole="creator">
                    <CreatorPanel />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </ContentProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
