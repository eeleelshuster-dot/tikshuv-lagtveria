import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Plus,
  Search,
  ChevronLeft,
  Lock,
  Settings,
} from "lucide-react";
import { useContent } from "@/contexts/ContentContext";
import { useAuth } from "@/contexts/AuthContext";

// Allowlist of CMS-configurable icons — avoids bundling the entire lucide library
const CMS_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Plus, Search, Lock, Settings, ShieldCheck,
};

const Index = () => {
  const { content, getContentProps } = useContent();

  // Returns icon component with consistent sizing — NO physical margin (gap handles spacing)
  const renderIcon = (iconName: string | undefined, fallback: React.ReactNode) => {
    if (!iconName) return fallback;
    const IconComponent = CMS_ICONS[iconName];
    return IconComponent ? <IconComponent className="icon-lg" /> : fallback;
  };

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
  };

  return (
    <main className="page-center">
      <div className="relative z-10 w-full max-w-2xl animate-fade-in space-y-10">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest animate-slide-up">
            <ShieldCheck className="icon-sm" />
            מערכת ניהול פניות רשמית
          </div>
          <h1 className={`font-rubik font-bold text-white leading-tight tracking-tight drop-shadow-2xl ${getStyle("home_hero_title") || "text-4xl sm:text-6xl"}`}>
            {content["home_hero_title"]}
          </h1>
          <p className={`text-white/60 font-assistant mx-auto max-w-lg leading-relaxed ${getStyle("home_hero_subtitle") || "text-lg sm:text-xl"}`}>
            {content["home_hero_subtitle"]}
          </p>
        </div>

        {/* Action Grid */}
        <div className="glass-card p-2 sm:p-4 border-white/10 shadow-2xl backdrop-blur-2xl">
          <div className="grid grid-cols-1 gap-3">
            <Button asChild variant="hero" size="xl" className={`w-full group h-20 text-xl shadow-glow-primary ${getStyle("home_btn_open")}`}>
              <Link to="/open-ticket" className="flex items-center justify-between px-6">
                <span className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    {renderIcon(getContentProps("home_btn_open").icon, <Plus className="icon-lg" />)}
                  </div>
                  {content["home_btn_open"]}
                </span>
                <ChevronLeft className="icon-lg opacity-40 group-hover:translate-x-[-4px] transition-transform shrink-0" />
              </Link>
            </Button>

            <Button asChild variant="heroOutline" size="xl" className={`w-full group h-20 text-xl border-white/10 bg-white/5 hover:bg-white/10 text-white ${getStyle("home_btn_track")}`}>
              <Link to="/track-ticket" className="flex items-center justify-between px-6">
                <span className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    {renderIcon(getContentProps("home_btn_track").icon, <Search className="icon-lg" />)}
                  </div>
                  {content["home_btn_track"]}
                </span>
                <ChevronLeft className="icon-lg opacity-40 group-hover:translate-x-[-4px] transition-transform shrink-0" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex flex-col items-center gap-4">
          <Button asChild variant="ghost" className={`text-white/40 hover:text-white hover:bg-white/5 px-8 h-12 rounded-xl transition-all ${getStyle("home_link_admin")}`}>
            <Link to="/admin-login" className="flex items-center gap-2">
              <Lock className="icon-sm" />
              <span>כניסת סגל ומנהלים</span>
            </Link>
          </Button>
          <AuthLinkToCreator />
        </div>

        <div className="text-center pt-8">
          <p className={`text-[10px] text-white/20 font-bold uppercase tracking-[0.3em] font-assistant ${getStyle("home_footer_credit")}`}>
            {content["home_footer_credit"]}
          </p>
        </div>
      </div>
    </main>
  );
};

const AuthLinkToCreator = () => {
  const { profile } = useAuth();
  if (profile?.role !== "creator") return null;

  return (
    <Button asChild variant="heroOutline" size="xl" className="w-full border-primary/40 text-primary hover:bg-primary/10">
      <Link to="/creator" className="flex items-center justify-center gap-2">
        <Settings className="icon-sm" />
        <span>פאנל יוצר (מנהל על)</span>
      </Link>
    </Button>
  );
};

export default Index;
