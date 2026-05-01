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
        hour: "2-digit", 
        minute: "2-digit" 
    });
  };

  return (
    <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4 py-8">
      <div className="relative z-10 w-full max-w-xl animate-fade-in">
        <h1 className="h1 text-center mb-2">
          {content["track_ticket_title"]}
        </h1>
        {content["track_ticket_subtitle"] && (
           <p className="text-muted-foreground font-assistant text-center mb-8 text-lg">
            עקוב אחר סטטוס הטיפול בפנייתך בזמן אמת.
          </p>
        )}

        <div className="glass-card p-6 sm:p-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <label className="block font-assistant font-bold text-foreground text-sm">
              {content["label_ticket_number"]}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                className="flex-1 min-w-0 h-12 px-4 rounded-lg border border-border bg-input font-mono-ticket focus-double-ring"
                placeholder={content["placeholder_ticket_number"]}
              />
              <Button type="submit" variant="default" className="h-12 px-6 flex-row-reverse font-bold shadow-premium" disabled={loading}>
                {renderIcon(getContentProps("btn_search_ticket").icon, <LucideIcons.Search className="mr-2 w-4 h-4" />)}
                {loading ? "מחפש..." : content["btn_search_ticket"]}
              </Button>
            </div>
            {error && <p className="text-destructive text-sm font-assistant flex items-center gap-1"><LucideIcons.AlertCircle className="w-3.5 h-3.5" />{error}</p>}
          </form>
        </div>

        {searched && (
          <div className="mt-6 animate-fade-in">
            {ticket ? (
              <div className="glass-card p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/30">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground font-assistant mb-1 uppercase tracking-wider">מספר פנייה</span>
                    <span className="font-mono-ticket text-3xl font-bold text-primary">{ticket.ticket_number}</span>
                  </div>
                  <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                </div>

                {/* Timeline Visualization */}
                <div className="mb-10">
                  <h3 className="text-xs font-rubik font-bold text-muted-foreground mb-4 uppercase tracking-wider">מצב הטיפול בפנייה</h3>
                  <div className="bg-secondary/10 p-4 rounded-xl border border-border/30">
                    <TicketTimeline status={ticket.status} />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-8 text-[11px] text-muted-foreground font-bold bg-secondary/30 w-fit px-3 py-1.5 rounded-full border border-border/20">
                  <LucideIcons.Calendar className="w-3.5 h-3.5" />
                  <span>נפתחה בתאריך: {formatDate(ticket.created_at)}</span>
                </div>

                {ticket.updates.length > 0 && (
                  <div className="pt-6 border-t border-border/50">
                    <h3 className="font-rubik font-bold text-foreground text-sm mb-6 flex items-center gap-2">
                      <LucideIcons.History className="w-4 h-4 text-primary" />
                      יומן טיפול
                    </h3>
                    <div className="space-y-6">
                      {ticket.updates.map((update, i) => (
                        <div key={i} className="relative pr-6 border-r-2 border-primary/20 pb-2">
                          <div className="absolute top-1 -right-1.5 w-3 h-3 rounded-full bg-primary/40 shadow-sm" />
                          <p className="text-sm font-assistant text-foreground leading-relaxed font-medium">{update.update_text}</p>
                          <span className="text-[10px] text-muted-foreground font-mono mt-2 block opacity-70">{formatDate(update.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ticket.status === 'closed' && !ticket.is_closed_confirmed && (
                  <div className="mt-10 pt-8 border-t-2 border-dashed border-border/50 text-center">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
                      <p className="text-sm font-assistant text-foreground font-bold mb-2">
                        סיימנו לטפל בפנייתך!
                      </p>
                      <p className="text-xs font-assistant text-muted-foreground">
                        נשמח אם תאשר את סגירת הפנייה כמשוב חיובי על השירות שקיבלת.
                      </p>
                    </div>
                    <Button onClick={handleConfirmClosure} disabled={confirming} className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 shadow-premium transition-transform active:scale-[0.98]">
                      <LucideIcons.CheckCircle2 className="ml-2 w-6 h-6" />
                      {confirming ? "מאשר סגירה..." : "אשר סגירת פנייה וסיים"}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-lg p-6 shadow-lg text-center">
                <p className="text-card-foreground font-assistant">{content["admin_dashboard_no_tickets"]}</p>
              </div>
            )}
          </div>
        )}

        <div className="text-center mt-6">
          <Button asChild variant="ghost" className="text-foreground/70 hover:text-foreground">
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
