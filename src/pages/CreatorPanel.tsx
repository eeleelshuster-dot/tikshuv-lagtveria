import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "@/components/creator/UserManagement";
import { ContentManagement } from "@/components/creator/ContentManagement";
import { useContent } from "@/contexts/ContentContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const CreatorPanel = () => {
  const { session } = useAuth();
  const { content, refreshContent } = useContent();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"users" | "content" | "import">("users");

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(content, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "site_content_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast({ title: "הקובץ יוצא בהצלחה" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (typeof json !== 'object') throw new Error("Invalid format");

        const entries = Object.entries(json).map(([key, value]) => ({
          key,
          value_published: typeof value === 'string' ? value : JSON.stringify(value),
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
          .from("app_content")
          .upsert(entries, { onConflict: "key" });

        if (error) throw error;
        
        toast({ title: "הנתונים יובאו בהצלחה", description: `${entries.length} מפתחות עודכנו.` });
        refreshContent();
      } catch (err: any) {
        toast({ title: "שגיאה בייבוא הקובץ", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-gradient-main min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="max-w-6xl mx-auto space-y-10 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold font-rubik text-white tracking-tight flex items-center gap-3">
              <LucideIcons.ShieldAlert className="w-9 h-9 text-primary shadow-glow-primary" />
              פאנל יוצר מערכת
            </h1>
            <p className="text-white/40 font-assistant text-xl">ניהול מתקדם, הרשאות על ותוכן דינמי</p>
          </div>
          <Button asChild variant="outline" className="h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl px-6">
            <Link to="/admin" className="flex items-center gap-2">
              <LucideIcons.LayoutDashboard className="w-4 h-4" />
              <span>חזרה ללוח מנהל</span>
            </Link>
          </Button>
        </div>

        {/* Custom Tabs Navigation */}
        <div className="relative z-20 grid grid-cols-1 sm:flex sm:flex-wrap gap-3 p-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md w-full sm:w-fit">
          {[
            { id: 'users', label: 'ניהול משתמשים', icon: LucideIcons.Users },
            { id: 'content', label: 'ניהול תוכן (CMS)', icon: LucideIcons.Settings },
            { id: 'import', label: 'גיבוי ונתונים', icon: LucideIcons.Database },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
              }}
              className={`flex items-center justify-center sm:justify-start gap-3 px-6 py-4 rounded-xl font-rubik font-bold text-sm transition-all pointer-events-auto ${
                activeTab === tab.id 
                ? "bg-primary text-white shadow-glow-primary" 
                : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Container */}
        <div className="animate-slide-up">
          {activeTab === "users" && (
            <div className="glass-card p-8 border-white/5">
              <UserManagement session={session} />
            </div>
          )}
          
          {activeTab === "content" && (
            <div className="glass-card p-8 border-white/5 min-h-[400px]">
              <ErrorBoundary fallbackMessage="שגיאה בטעינת ממשק ניהול התוכן. נסה לרענן את הדף.">
                <ContentManagement />
              </ErrorBoundary>
            </div>
          )}

          {activeTab === "import" && (
            <div className="glass-card p-12 text-center max-w-3xl mx-auto space-y-8 border-white/10 shadow-2xl">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary group-hover:scale-110 transition-transform">
                <LucideIcons.Database className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-rubik text-2xl font-bold text-white">ארכיון ונתוני מערכת</h3>
                <p className="text-white/40 font-assistant text-lg max-w-md mx-auto">ייצוא וייבוא מהיר של מילון הטקסטים והגדרות העיצוב לגיבוי או העברה.</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <Button 
                  onClick={handleExport} 
                  className="btn-primary h-14 rounded-2xl text-lg flex items-center justify-center gap-3"
                >
                  <LucideIcons.Download className="w-5 h-5" />
                  ייצוא נתונים (JSON)
                </Button>
                
                <div className="relative group">
                  <Button 
                    variant="outline" 
                    className="w-full h-14 rounded-2xl text-lg border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-3"
                  >
                    <LucideIcons.Upload className="w-5 h-5" />
                    ייבוא קובץ נתונים
                  </Button>
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImport}
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-white/20 uppercase tracking-[0.2em] pt-4">
                <LucideIcons.ShieldAlert className="w-4 h-4 text-accent-gold/40" />
                מומלץ לבצע גיבוי לפני כל שינוי משמעותי במערכת
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-center pt-8 border-t border-white/5">
          <Button asChild variant="ghost" className="text-white/30 hover:text-white rounded-xl transition-all">
            <Link to="/" className="flex items-center gap-2">
              <LucideIcons.ArrowRight className="w-4 h-4" />
              <span>חזרה לדף הבית</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreatorPanel;

