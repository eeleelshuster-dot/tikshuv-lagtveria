import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, User, Clock, ArrowRight } from "lucide-react";

interface AuditEntry {
  id: string;
  key: string;
  previous_value: string;
  new_value: string;
  changed_at: string;
  changed_by_name?: string;
  status: string;
}

export const HistoryManagement = () => {
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from("content_audit_log" as any) as any)
        .select(`
          id,
          key,
          previous_value,
          new_value,
          changed_at,
          status,
          profiles:changed_by ( full_name )
        `)
        .order("changed_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const formatted = (data as any[]).map(item => ({
        id: item.id,
        key: item.key,
        previous_value: item.previous_value,
        new_value: item.new_value,
        changed_at: item.changed_at,
        changed_by_name: item.profiles?.full_name || "מערכת",
        status: item.status
      }));

      setHistory(formatted);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (iso: string) => new Date(iso).toLocaleString("he-IL", { 
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" 
  });

  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-lg shadow border border-border">
        <h2 className="text-xl font-rubik font-bold text-card-foreground">היסטוריית שינויים</h2>
        <p className="text-sm font-assistant text-muted-foreground">מעקב אחר כל העדכונים שבוצעו בתוכן המערכת</p>
      </div>

      {loading ? (
        <div className="text-center p-8 animate-pulse text-muted-foreground">טוען היסטוריה...</div>
      ) : (
        <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-xs font-rubik text-muted-foreground">
                  <th className="p-3">זמן שינוי</th>
                  <th className="p-3">מפתח תוכן</th>
                  <th className="p-3">שינוי</th>
                  <th className="p-3">בוצע ע"י</th>
                  <th className="p-3">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-assistant">
                        <Clock className="w-3 h-3" />
                        {formatDate(entry.changed_at)}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded border border-border/50">
                        {entry.key}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 max-w-[250px]">
                        <span className="text-[11px] text-muted-foreground line-clamp-1">{entry.previous_value || "(ריק)"}</span>
                        <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                        <span className="text-xs font-medium text-foreground line-clamp-2">{entry.new_value}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-xs font-assistant">
                        <User className="w-3 h-3 text-muted-foreground" />
                        {entry.changed_by_name}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 rounded-full border border-green-500/20">
                        {entry.status === 'published' ? 'פורסם' : 'טיוטה'}
                      </span>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground font-assistant">
                      לא נמצאו שינויים אחרונים.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
