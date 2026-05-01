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
        <h1 className={`font-rubik font-bold text-foreground text-center ${getStyle("track_ticket_title") || "text-3xl mb-4"}`}>
          {content["track_ticket_title"]}
        </h1>
        {content["track_ticket_subtitle"] && (
           <p className="text-muted-foreground font-assistant text-center mb-8">
            עקוב אחר סטטוס הטיפול בפנייתך בזמן אמת.
          </p>
        )}

        <form onSubmit={handleSearch} className="bg-card/70 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-2xl border border-border/50">
          <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_ticket_number")}`}>
            {content["label_ticket_number"]}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              className="flex-1 min-w-0 h-11 px-4 rounded-md border border-border bg-input font-mono-ticket focus-double-ring transition-all duration-150"
              placeholder={content["placeholder_ticket_number"]}
            />
            <Button type="submit" variant="default" size="default" className={`h-11 shrink-0 flex-row-reverse ${getStyle("btn_search_ticket")}`} disabled={loading}>
              {renderIcon(getContentProps("btn_search_ticket").icon, <LucideIcons.Search className="mr-1" />)}
              {loading ? "מחפש..." : content["btn_search_ticket"]}
            </Button>
          </div>
          {error && <p className="text-destructive text-sm mt-2 font-assistant">{error}</p>}
        </form>

        {searched && (
          <div className="mt-6 animate-fade-in">
            {ticket ? (
              <div className="bg-card/80 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-2xl border border-border/50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground font-assistant mb-1">פנייה מספר</span>
                    <span className="font-mono-ticket text-2xl font-bold text-primary">{ticket.ticket_number}</span>
                  </div>
                  <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                </div>

                {/* Timeline Visualization */}
                <div className="mb-8 p-4 bg-secondary/20 rounded-lg border border-border/30">
                  <h3 className="text-xs font-rubik font-bold text-muted-foreground mb-4 uppercase tracking-wider">תהליך הטיפול בפנייה</h3>
                  <TicketTimeline status={ticket.status} />
                </div>

                <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground bg-muted/30 w-fit px-3 py-1.5 rounded-full border border-border/20">
                  <LucideIcons.Calendar className="w-3.5 h-3.5" />
                  <span>נפתחה בתאריך: {formatDate(ticket.created_at)}</span>
                </div>
                {ticket.updates.length > 0 && (
                  <div className="border-t border-border/50 pt-6">
                    <h3 className="font-rubik font-bold text-card-foreground text-sm mb-4 flex items-center gap-2">
                      <LucideIcons.History className="w-4 h-4 text-primary" />
                      עדכוני מערכת אחרונים
                    </h3>
                    <div className="space-y-4">
                      {ticket.updates.map((update, i) => (
                        <div key={i} className="relative pr-4 border-r-2 border-primary/20 pb-1">
                          <div className="absolute top-0 -right-1.5 w-3 h-3 rounded-full bg-primary/30" />
                          <p className="text-sm font-assistant text-card-foreground leading-relaxed">{update.update_text}</p>
                          <span className="text-[10px] text-muted-foreground font-mono mt-1 block">{formatDate(update.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ticket.status === 'closed' && !ticket.is_closed_confirmed && (
                  <div className="mt-8 pt-6 border-t border-border/50 text-center">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                      <p className="text-sm font-assistant text-amber-600 font-bold mb-2">
                        הטיפול בפנייתך הושלם.
                      </p>
                      <p className="text-xs font-assistant text-amber-500">
                        האם אתה מאשר את סגירת הפנייה? אישור זה יעזור לנו לשפר את השירות.
                      </p>
                    </div>
                    <Button onClick={handleConfirmClosure} disabled={confirming} className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 shadow-lg transition-transform active:scale-[0.98]">
                      <LucideIcons.CheckCircle2 className="ml-2 w-5 h-5" />
                      {confirming ? "מאשר סגירה..." : "אשר סגירת פנייה"}
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
