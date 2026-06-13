import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PasswordInput from "@/components/PasswordInput";
import { useContent } from "@/contexts/ContentContext";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, profile, signIn, signOut, loading: authLoading } = useAuth();
  const { content, getContentProps } = useContent();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => parseInt(localStorage.getItem("admin_login_fails") || "0"));
  const [lockoutUntil, setLockoutUntil] = useState(() => parseInt(localStorage.getItem("admin_lockout_until") || "0"));
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutUntil > Date.now()) {
      setLockoutRemaining(Math.ceil((lockoutUntil - Date.now()) / 1000));
      interval = setInterval(() => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutRemaining(0);
          setFailedAttempts(0);
          localStorage.removeItem("admin_login_fails");
          localStorage.removeItem("admin_lockout_until");
        } else {
          setLockoutRemaining(remaining);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  useEffect(() => {
    if (!authLoading && user && profile) {
      if (profile.must_change_password) {
        navigate("/change-password", { replace: true });
      } else if (profile.role === "creator") {
        navigate("/creator", { replace: true });
      } else if (profile.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (profile.role === "commander") {
        navigate("/commander", { replace: true });
      } else {
        signOut().then(() => navigate("/admin-login", { replace: true }));
      }
    }
  }, [user, profile, authLoading, navigate]);

  // Returns icon with consistent size — gap on parent handles spacing
  const renderIcon = (iconName: string | undefined, fallback: React.ReactNode) => {
    if (!iconName) return fallback;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="icon-2xl" /> : fallback;
  };

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) {
      setError(`חשבון ננעל עקב ניסיונות מרובים. נסה שוב בעוד ${lockoutRemaining} שניות.`);
      return;
    }
    if (!username.trim() || !password.trim()) {
      setError("נא למלא את כל השדות");
      return;
    }
    setLoading(true);
    setError("");

    const { error: loginError } = await signIn(username.trim(), password);
    setLoading(false);
    if (loginError) {
      const newFails = failedAttempts + 1;
      setFailedAttempts(newFails);
      localStorage.setItem("admin_login_fails", newFails.toString());
      if (newFails >= 5) {
        const until = Date.now() + 5 * 60 * 1000;
        setLockoutUntil(until);
        localStorage.setItem("admin_lockout_until", until.toString());
        setError("יותר מדי ניסיונות כושלים. החשבון ננעל ל-5 דקות.");
      } else {
        setError(loginError);
      }
    } else {
      setFailedAttempts(0);
      localStorage.removeItem("admin_login_fails");
      localStorage.removeItem("admin_lockout_until");
    }
  };

  return (
    <div className="page-center">
      <div className="relative z-10 form-wrapper">
        {/* Hero Icon + Title */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto text-primary shadow-glow-primary">
            {renderIcon(getContentProps("admin_login_title").icon, <LucideIcons.ShieldAlert className="icon-2xl" />)}
          </div>
          <h1 className={`font-rubik font-bold text-white tracking-tight leading-tight ${getStyle("admin_login_title") || "text-3xl sm:text-4xl"}`}>
            {content["admin_login_title"]}
          </h1>
          <p className="text-white/40 font-assistant text-lg">גישה מורשית לסגל בלבד</p>
        </div>

        {/* Form card */}
        <div className="glass-card p-8 sm:p-10 border-white/10 shadow-2xl space-y-6">
          <form onSubmit={handleLogin} className="space-y-6">

            {/* Username */}
            <div className="space-y-2">
              <label className="field-label">{content["label_username"]}</label>
              <div className="relative group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="glass-input pr-12"
                  placeholder={content["placeholder_username"]}
                  autoComplete="username"
                />
                <LucideIcons.User className="icon-md absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="field-label">{content["label_password"]}</label>
              <div className="relative group">
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={content["placeholder_password"]}
                  autoComplete="current-password"
                  className="glass-input pr-12"
                />
                <LucideIcons.Key className="icon-md absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-3 px-1">
              <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer h-full w-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute inset-0 bg-white/5 border border-white/10 rounded peer-checked:bg-primary peer-checked:border-primary transition-all" />
                <LucideIcons.Check className="icon-xs absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <label htmlFor="remember" className="text-sm text-white/40 font-assistant cursor-pointer select-none">
                {content["checkbox_remember"]}
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-bold flex items-start gap-3 animate-shake">
                <LucideIcons.AlertTriangle className="icon-md shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full btn-primary h-16 rounded-2xl text-xl group"
              disabled={loading || lockoutRemaining > 0}
            >
              <span className="font-bold">
                {lockoutRemaining > 0 ? `נעילה (${lockoutRemaining}ש')` : loading ? content["msg_logging_in"] : content["btn_login"]}
              </span>
              {!loading && <LucideIcons.ShieldCheck className="icon-lg group-hover:scale-110 transition-transform" />}
            </Button>
          </form>
        </div>

        {/* Back */}
        <div className="text-center">
          <Button asChild variant="ghost" className="text-white/30 hover:text-white rounded-xl">
            <Link to="/" className="flex items-center gap-2">
              <LucideIcons.ArrowRight className="icon-sm" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
