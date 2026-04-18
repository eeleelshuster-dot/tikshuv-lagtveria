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
    <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4">
      <div className="relative z-10 text-center w-full max-w-md animate-fade-in">
        <h1 className={`font-rubik font-bold text-foreground leading-tight ${getStyle("home_hero_title") || "text-2xl sm:text-3xl mb-3"}`}>
          {content["home_hero_title"]}
        </h1>
        <p className={`text-foreground/70 font-assistant ${getStyle("home_hero_subtitle") || "text-base sm:text-lg mb-10"}`}>
          {content["home_hero_subtitle"]}
        </p>

        <div className="flex flex-col gap-4 w-full">
          <Button asChild variant="hero" size="xl" className={`w-full flex-row-reverse ${getStyle("home_btn_open")}`}>
            <Link to="/open-ticket">
              <span>{content["home_btn_open"]}</span>
              {renderIcon(getContentProps("home_btn_open").icon, <LucideIcons.Send className="mr-2" />)}
            </Link>
          </Button>

          <Button asChild variant="hero" size="xl" className={`w-full flex-row-reverse ${getStyle("home_btn_track")}`}>
            <Link to="/track-ticket">
              <span>{content["home_btn_track"]}</span>
              {renderIcon(getContentProps("home_btn_track").icon, <LucideIcons.Search className="mr-2" />)}
            </Link>
          </Button>

          <Button asChild variant="heroOutline" size="xl" className={`w-full flex-row-reverse ${getStyle("home_link_admin")}`}>
            <Link to="/admin-login">
              <span>{content["home_link_admin"]}</span>
              {renderIcon(getContentProps("home_link_admin").icon, <LucideIcons.Lock className="mr-2" />)}
            </Link>
          </Button>

          {/* Add direct link to Creator Panel for logged in creators */}
          <AuthLinkToCreator />
        </div>
        
        <p className={`text-xs text-muted-foreground mt-12 font-assistant ${getStyle("home_footer_credit")}`}>
          {content["home_footer_credit"]}
        </p>
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
