import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/contexts/ContentContext";
import { StatusBadge, TicketTimeline } from "@/components/TicketUI";
import { formatError } from "@/utils/errorHandler";

type TicketStatus = "sent" | "in_progress" | "resolved" | "closed";

// Replaced by StatusBadge component config

interface TicketResult {
  ticket_number: string;
  status: TicketStatus;
  created_at: string;
  is_closed_confirmed: boolean;
  updates: { created_at: string; update_text: string }[];
}

const TrackTicket = () => {
  const { content, getContentProps } = useContent();
  const [ticketInput, setTicketInput] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<TicketResult | null>(null);

  const renderIcon = (iconName: string | undefined, fallback: any) => {
    if (!iconName) return fallback;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="mr-2" /> : fallback;
  };

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputToSearch = ticketInput.trim().toUpperCase();
    
    if (!inputToSearch) {
      setError(content["placeholder_ticket_number"] || "הזן מספר פנייה");
      setTicket(null);
      setSearched(false);
      return;
    }
    
    if (!inputToSearch.startsWith("TK-")) {
      setError("מספר פנייה חייב להכיל קידומת TK- (לדוגמה: TK-651295)");
      setTicket(null);
      setSearched(false);
      return;
    }
    
    setError("");
    setLoading(true);

    const { data: fullTicket, error: fetchErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, status, created_at, is_closed_confirmed")
      .eq("ticket_number", inputToSearch)
      .single();

    if (fetchErr || !fullTicket) {
      setTicket(null);
      setSearched(true);
      setLoading(false);
      return;
    }

    const { data: updates } = await supabase
      .from("ticket_updates")
      .select("created_at, update_text")
      .eq("ticket_id", (fullTicket as any).id)
      .order("created_at", { ascending: true });

    setTicket({
      ticket_number: (fullTicket as any).ticket_number,
      status: (fullTicket as any).status as TicketStatus,
      created_at: (fullTicket as any).created_at,
      is_closed_confirmed: (fullTicket as any).is_closed_confirmed,
      updates: (updates as any[]) || [],
    });
    setSearched(true);
    setLoading(false);
  };

  const handleConfirmClosure = async () => {
    if (!ticket) return;
    setConfirming(true);
    try {
      const { error: confirmErr } = await supabase.rpc('confirm_ticket_closure_public', { 
        p_ticket_number: ticket.ticket_number 
      });
      if (confirmErr) throw confirmErr;

      setTicket(prev => prev ? { ...prev, is_closed_confirmed: true } : null);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("he-IL", { 
        timeZone: "Asia/Jerusalem",
        day: "2-digit", 
        month: "2-digit", 
        year: "numeric", 
        hour: "2-digit",   return (
    <div className="bg-gradient-main min-h-screen px-4 py-12 flex items-center justify-center">
      <div className="relative z-10 w-full max-w-2xl animate-fade-in space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-rubik font-bold text-white tracking-tight leading-tight">
            {content["track_ticket_title"]}
          </h1>
          <p className="text-white/40 font-assistant text-lg sm:text-xl max-w-md mx-auto">
            {content["track_ticket_subtitle"] || "עקוב אחר סטטוס הטיפול בפנייתך בזמן אמת."}
          </p>
        </div>

        <div className="glass-card p-8 sm:p-10 border-white/10 shadow-2xl space-y-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <label className="text-xs font-bold text-white/40 uppercase tracking-widest block px-1">
              {content["label_ticket_number"]}
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full group">
                <input
                  type="text"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value)}
                  className="glass-input h-14 w-full pr-12 rounded-xl font-mono text-lg transition-all"
                  placeholder={content["placeholder_ticket_number"] || "TK-XXXXXX"}
                />
                <LucideIcons.Hash className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
              </div>
              <Button 
                type="submit" 
                className="btn-primary w-full sm:w-auto h-14 px-8 rounded-xl text-lg group" 
                disabled={loading}
              >
                {loading ? <LucideIcons.Loader2 className="w-6 h-6 animate-spin" /> : <LucideIcons.Search className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                <span className="mr-3">{loading ? "מחפש..." : content["btn_search_ticket"]}</span>
              </Button>
            </div>
            {error && (
              <p className="text-destructive text-xs font-bold flex items-center gap-1.5 px-1 animate-shake">
                <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </form>

          {searched && (
            <div className="pt-8 border-t border-white/10 animate-slide-up">
              {ticket ? (
                <div className="space-y-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">זיהוי פנייה פעיל</span>
                      <h2 className="font-mono text-4xl font-bold text-primary tracking-tighter">
                        {ticket.ticket_number}
                      </h2>
                    </div>
                    <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                  </div>

                  {/* Operational Timeline */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                      <LucideIcons.Activity className="w-4 h-4 text-primary" />
                      מצב הטיפול המבצעי
                    </h3>
                    <div className="bg-white/5 p-8 rounded-3xl border border-white/5 shadow-inner-soft">
                      <TicketTimeline status={ticket.status} />
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold text-white/40 uppercase tracking-widest">
                    <LucideIcons.Calendar className="w-3.5 h-3.5" />
                    נפתחה ב: {formatDate(ticket.created_at)}
                  </div>

                  {ticket.updates.length > 0 && (
                    <div className="space-y-6 pt-4">
                      <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                        <LucideIcons.History className="w-4 h-4 text-primary" />
                        יומן אירועים אחרונים
                      </h3>
                      <div className="space-y-6 relative before:absolute before:right-[7px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                        {ticket.updates.map((update, i) => (
                          <div key={i} className="relative pr-8 animate-fade-in group">
                            <div className="absolute right-0 top-1.5 w-4 h-4 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center transition-all group-hover:border-primary/40">
                              <div className="w-1 h-1 rounded-full bg-primary" />
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group-hover:border-white/10 transition-all">
                              <p className="text-base font-assistant text-white/80 leading-relaxed">{update.update_text}</p>
                              <span className="text-[10px] text-white/20 font-mono mt-3 block">{formatDate(update.created_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ticket.status === 'closed' && !ticket.is_closed_confirmed && (
                    <div className="mt-10 p-8 rounded-3xl bg-primary/10 border border-primary/20 space-y-6 text-center animate-pulse-soft">
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold text-white">הטיפול בפנייתך הושלם בהצלחה!</h4>
                        <p className="text-white/50 font-assistant">נשמח לאישור סגירה סופי ממך כמשוב על איכות השירות.</p>
                      </div>
                      <Button 
                        onClick={handleConfirmClosure} 
                        disabled={confirming} 
                        className="w-full btn-primary h-16 rounded-2xl text-xl shadow-glow-primary group"
                      >
                        {confirming ? <LucideIcons.Loader2 className="w-6 h-6 animate-spin" /> : <LucideIcons.CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                        <span className="mr-3">{confirming ? "מאשר סגירה..." : "אשר סגירת פנייה"}</span>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center mx-auto text-destructive opacity-40">
                    <LucideIcons.SearchX className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-white/60 font-assistant text-xl font-bold">לא מצאנו פנייה כזו</p>
                    <p className="text-white/20 font-assistant">בדוק שוב את מספר הפנייה שהזנת (כולל TK-)</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-center pt-4">
          <Button asChild variant="ghost" className="text-white/30 hover:text-white rounded-xl">
            <Link to="/" className="flex items-center gap-2">
              <LucideIcons.ArrowRight className="w-4 h-4" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};>
            <Link to="/">
              <LucideIcons.ArrowRight className="ml-2" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TrackTicket;
