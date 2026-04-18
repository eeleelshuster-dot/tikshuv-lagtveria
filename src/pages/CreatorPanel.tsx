import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Settings, Users, LayoutDashboard, Database, History, Download, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserManagement } from "@/components/creator/UserManagement";
import { ContentManagement } from "@/components/creator/ContentManagement";
import { HistoryManagement } from "@/components/creator/HistoryManagement";
import { useContent } from "@/contexts/ContentContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CreatorPanel = () => {
  const { session } = useAuth();
  const { content, refreshContent } = useContent();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"users" | "content" | "import" | "history">("users");

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
    <div className="bg-gradient-main min-h-screen px-4 py-6">
      <div className="relative z-10 max-w-5xl mx-auto animate-fade-in">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="font-rubik text-2xl sm:text-3xl font-bold text-foreground">לוח יוצר מערכת (Creator Panel)</h1>
            <p className="text-muted-foreground font-assistant mt-1">ניהול מתקדם, משתמשים ותוכן מערכת</p>
          </div>
          <Button asChild variant="outline" className="flex-row-reverse border-border">
            <Link to="/admin">
              <span>מעבר ללוח מנהל</span>
              <LayoutDashboard className="mr-2 w-4 h-4" />
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50 mb-6 overflow-x-auto">
          <button 
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-6 py-3 font-rubik text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="w-4 h-4" />
            ניהול משתמשים
          </button>
          <button 
            onClick={() => setActiveTab("content")}
            className={`flex items-center gap-2 px-6 py-3 font-rubik text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === "content" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Settings className="w-4 h-4" />
            ניהול תוכן ועיצוב (CMS)
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-6 py-3 font-rubik text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <History className="w-4 h-4" />
            היסטוריית שינויים
          </button>
          <button 
            onClick={() => setActiveTab("import")}
            className={`flex items-center gap-2 px-6 py-3 font-rubik text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === "import" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Database className="w-4 h-4" />
            גיבוי וייבוא נתונים
          </button>
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {activeTab === "users" && <UserManagement session={session} />}
          
          {activeTab === "content" && <ContentManagement />}

          {activeTab === "history" && <HistoryManagement />}

          {activeTab === "import" && (
            <div className="bg-card p-8 rounded-lg shadow border border-border text-center space-y-6">
              <Database className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
              <div>
                <h3 className="font-rubik text-xl text-card-foreground">ניהול נתוני מערכת</h3>
                <p className="text-muted-foreground font-assistant mt-2">ייצוא וייבוא מהיר למילון הטקסטים והעיצובים ברמת המערכת.</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button onClick={handleExport} variant="outline" className="flex-row-reverse gap-2 h-12 px-8">
                  <Download className="w-4 h-4" />
                  ייצוא כל הנתונים (JSON)
                </Button>
                
                <div className="relative">
                   <Button variant="outline" className="flex-row-reverse gap-2 h-12 px-8 w-full">
                    <Upload className="w-4 h-4" />
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
              
              <p className="text-[10px] text-muted-foreground">מומלץ לבצע גיבוי לפני כל שינוי משמעותי במערכת.</p>
            </div>
          )}
        </div>

        <div className="text-center mt-12">
          <Button asChild variant="ghost" className="text-foreground/70 hover:text-foreground">
            <Link to="/">
              <ArrowRight className="ml-2" />
              חזרה לדף הבית
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreatorPanel;
