import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PasswordInput from "@/components/PasswordInput";
import { useContent } from "@/contexts/ContentContext";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, profile, signIn, loading: authLoading } = useAuth();
  const { content, getContentProps } = useContent();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => parseInt(localStorage.getItem('admin_login_fails') || '0'));
  const [lockoutUntil, setLockoutUntil] = useState(() => parseInt(localStorage.getItem('admin_lockout_until') || '0'));
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
          localStorage.removeItem('admin_login_fails');
          localStorage.removeItem('admin_lockout_until');
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
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, profile, authLoading, navigate]);

  const renderIcon = (iconName: string | undefined, fallback: any) => {
    if (!iconName) return fallback;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="mr-2" /> : fallback;
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
      localStorage.setItem('admin_login_fails', newFails.toString());
      
      if (newFails >= 5) {
        const until = Date.now() + 5 * 60 * 1000; // 5 minutes
        setLockoutUntil(until);
        localStorage.setItem('admin_lockout_until', until.toString());
        setError(`יותר מדי ניסיונות כושלים. החשבון ננעל ל-5 דקות.`);
      } else {
        setError(loginError);
      }
    } else {
      setFailedAttempts(0);
      localStorage.removeItem('admin_login_fails');
      localStorage.removeItem('admin_lockout_until');
    }
  };

  return (
    <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            {renderIcon(getContentProps("admin_login_title").icon, <LucideIcons.Lock className="w-8 h-8 text-primary" />)}
          </div>
        </div>
        <h1 className={`font-rubik font-bold text-foreground text-center mb-8 ${getStyle("admin_login_title") || "text-2xl"}`}>
          {content["admin_login_title"]}
        </h1>

        <form onSubmit={handleLogin} className="bg-card rounded-lg p-6 sm:p-8 shadow-lg space-y-5">
          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_username")}`}>
              {content["label_username"]}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 px-4 rounded-md border border-border bg-input font-assistant focus-double-ring transition-all duration-150"
              placeholder={content["placeholder_username"]}
              autoComplete="username"
            />
          </div>

          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_password")}`}>
              {content["label_password"]}
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={content["placeholder_password"]}
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus-double-ring"
            />
            <label htmlFor="remember" className="text-sm text-card-foreground font-assistant cursor-pointer">
              {content["checkbox_remember"]}
            </label>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-destructive text-sm font-assistant">{error}</p>
            </div>
          )}

          <Button type="submit" variant="hero" size="xl" className={`w-full flex-row-reverse ${getStyle("btn_login")}`} disabled={loading || lockoutRemaining > 0}>
            <span>{lockoutRemaining > 0 ? `ננעל (${lockoutRemaining}ש')` : loading ? content["msg_logging_in"] : content["btn_login"]}</span>
            {renderIcon(getContentProps("btn_login").icon, <LucideIcons.Lock className="mr-2" />)}
          </Button>
        </form>

        <div className="text-center mt-6">
          <Button asChild variant="ghost" className="text-foreground/70 hover:text-foreground">
            <Link to="/">
              <LucideIcons.ArrowRight className="ml-2" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
