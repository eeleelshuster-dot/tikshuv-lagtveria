import { Loader2 } from "lucide-react";

export const LoadingScreen = () => {
  return (
    <div className="bg-gradient-main min-h-screen flex flex-col items-center justify-center px-4">
      <div className="relative flex flex-col items-center justify-center space-y-6 text-center">
        {/* Decorative backdrop glow */}
        <div className="absolute w-48 h-48 rounded-full bg-primary/10 blur-3xl -z-10 animate-pulse" />
        
        {/* Professional animated spinner */}
        <div className="relative flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>

        {/* Loading status texts in Hebrew */}
        <div className="space-y-2 select-none">
          <h2 className="font-rubik text-xl font-bold text-white tracking-wide animate-pulse">
            טוען את המערכת...
          </h2>
          <p className="font-assistant text-sm text-white/40">
            מבצע סנכרון נתונים, אנא המתן
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
