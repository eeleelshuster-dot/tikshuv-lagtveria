import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/contexts/ContentContext";

type TicketStatus = "sent" | "in_progress" | "resolved" | "closed";

const statusLabels: Record<TicketStatus, string> = {
  sent: "נשלח",
  in_progress: "בטיפול",
  resolved: "טופל",
  closed: "הפנייה נסגרה",
};

const statusStyles: Record<TicketStatus, string> = {
  sent: "bg-status-sent/20 text-status-sent",
  in_progress: "bg-status-progress/20 text-status-progress",
  resolved: "bg-status-resolved/20 text-status-resolved",
  closed: "bg-status-closed/20 text-status-closed",
};

interface TicketResult {
  ticket_number: string;
  status: TicketStatus;
  created_at: string;
  updates: { created_at: string; update_text: string }[];
}

const TrackTicket = () => {
  const { content, getContentProps } = useContent();
  const [ticketInput, setTicketInput] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
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
      .select("id, ticket_number, status, created_at")
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
      updates: (updates as any[]) || [],
    });
    setSearched(true);
    setLoading(false);
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
      <div className="relative z-10 w-full max-w-lg animate-fade-in">
        <h1 className={`font-rubik font-bold text-foreground text-center ${getStyle("track_ticket_title") || "text-2xl mb-8"}`}>
          {content["track_ticket_title"]}
        </h1>

        <form onSubmit={handleSearch} className="bg-card rounded-lg p-6 sm:p-8 shadow-lg">
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
              <div className="bg-card rounded-lg p-6 sm:p-8 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono-ticket text-lg font-bold text-card-foreground">{ticket.ticket_number}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-rubik font-medium ${statusStyles[ticket.status]}`}>
                    {statusLabels[ticket.status]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-assistant mb-4">
                  {content["label_date"]} פתיחה: {formatDate(ticket.created_at)}
                </p>
                {ticket.updates.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <h3 className="font-rubik font-semibold text-card-foreground text-sm mb-3">{content["label_recent_updates"]}</h3>
                    <div className="space-y-3">
                      {ticket.updates.map((update, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="text-muted-foreground font-mono-ticket whitespace-nowrap">{formatDate(update.created_at)}</span>
                          <span className="text-card-foreground font-assistant">{update.update_text}</span>
                        </div>
                      ))}
                    </div>
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
