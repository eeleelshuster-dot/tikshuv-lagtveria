import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export const useIdleDisconnect = (timeoutMs = 15 * 60 * 1000) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.signOut();
          toast({ 
            title: "התנתקות אוטומטית", 
            description: "נותקת עקב חוסר פעילות. אנא התחבר מחדש.",
            variant: "destructive"
          });
          navigate("/admin-login");
        }
      }, timeoutMs);
    };

    // Listen to generic activity markers globally
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer);
    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      clearTimeout(timeoutId);
    };
  }, [timeoutMs, navigate, toast]);
};
