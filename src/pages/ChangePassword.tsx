import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/contexts/ContentContext";
import PasswordInput from "@/components/PasswordInput";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { content, getContentProps } = useContent();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
  };

  const renderIcon = (iconName: string | undefined, fallback: any) => {
    if (!iconName) return fallback;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="mr-2" /> : fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(content["msg_password_min_length"]);
      return;
    }
    if (password !== confirm) {
      setError(content["msg_passwords_dont_match"]);
      return;
    }
    setLoading(true);
    setError("");

    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }

      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false } as any)
          .eq("id", user.id);
      }

      await refreshProfile();
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            <LucideIcons.Lock className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className={`font-rubik font-bold text-foreground text-center ${getStyle("change_password_title") || "text-2xl mb-2"}`}>
          {content["change_password_title"]}
        </h1>
        <p className={`text-foreground/70 font-assistant text-center ${getStyle("change_password_subtitle") || "mb-8"}`}>
          {content["change_password_subtitle"]}
        </p>

        <form onSubmit={handleSubmit} className="bg-card rounded-lg p-6 sm:p-8 shadow-lg space-y-5">
          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_new_password")}`}>
              {content["label_new_password"]}
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={content["placeholder_new_password"]}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_confirm_password")}`}>
              {content["label_confirm_password"]}
            </label>
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={content["placeholder_confirm_password"]}
              autoComplete="new-password"
            />
            {password && confirm && password === confirm && (
              <div className="flex items-center gap-1 mt-1 text-primary">
                <LucideIcons.CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-assistant">{content["msg_passwords_match"]}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-destructive text-sm font-assistant">{error}</p>
            </div>
          )}

          <Button type="submit" variant="hero" size="xl" className="w-full flex-row-reverse" disabled={loading}>
            <span>{loading ? content["msg_saving"] : content["btn_save_password"]}</span>
            {renderIcon(getContentProps("btn_save_password").icon, <LucideIcons.Lock className="mr-2" />)}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
