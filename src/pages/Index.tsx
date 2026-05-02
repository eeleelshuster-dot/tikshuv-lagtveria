import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useContent } from "@/contexts/ContentContext";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { content, getContentProps } = useContent();

  const renderIcon = (iconName: string | undefined, fallback: any) => {
    if (!iconName) return fallback;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="mr-2" /> : fallback;
  };

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
  };

  return (
    <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-2xl animate-fade-in space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest animate-slide-up">
            <LucideIcons.ShieldCheck className="w-4 h-4" />
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
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {renderIcon(getContentProps("home_btn_open").icon, <LucideIcons.Plus className="w-6 h-6" />)}
                  </div>
                  {content["home_btn_open"]}
                </span>
                <LucideIcons.ChevronLeft className="w-6 h-6 opacity-40 group-hover:translate-x-[-4px] transition-transform" />
              </Link>
            </Button>

            <Button asChild variant="heroOutline" size="xl" className={`w-full group h-20 text-xl border-white/10 bg-white/5 hover:bg-white/10 text-white ${getStyle("home_btn_track")}`}>
              <Link to="/track-ticket" className="flex items-center justify-between px-6">
                <span className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {renderIcon(getContentProps("home_btn_track").icon, <LucideIcons.Search className="w-6 h-6" />)}
                  </div>
                  {content["home_btn_track"]}
                </span>
                <LucideIcons.ChevronLeft className="w-6 h-6 opacity-40 group-hover:translate-x-[-4px] transition-transform" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Administrative Footer */}
        <div className="flex flex-col items-center gap-4">
          <Button asChild variant="ghost" className={`text-white/40 hover:text-white hover:bg-white/5 px-8 h-12 rounded-xl transition-all ${getStyle("home_link_admin")}`}>
            <Link to="/admin-login" className="flex items-center gap-2">
              <LucideIcons.Lock className="w-4 h-4" />
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
    </div>
  );
};

const AuthLinkToCreator = () => {
  const { profile } = useAuth();
  
  if (profile?.role !== "creator") return null;

  return (
    <Button asChild variant="heroOutline" size="xl" className="w-full flex-row-reverse border-primary/40 text-primary hover:bg-primary/10">
      <Link to="/creator">
        <span>פאנל יוצר (מנהל על)</span>
        <LucideIcons.Settings className="mr-2 w-4 h-4" />
      </Link>
    </Button>
  );
};

export default Index;
