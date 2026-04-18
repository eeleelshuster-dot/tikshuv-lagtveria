import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useContent } from "@/contexts/ContentContext";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { content, getContentProps } = useContent();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
  };

  return (
    <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md text-center animate-fade-in">
        <h1 className={`font-rubik font-bold text-foreground ${getStyle("not_found_title") || "text-6xl mb-4"}`}>
          {content["not_found_title"]}
        </h1>
        <p className={`font-assistant text-xl text-foreground/70 ${getStyle("not_found_subtitle") || "mb-8"}`}>
          {content["not_found_subtitle"]}
        </p>
        <Button asChild variant="hero" size="xl" className="flex-row-reverse mx-auto">
          <Link to="/">
            <span>{content["btn_back_home"]}</span>
            <Home className="mr-2 w-5 h-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
