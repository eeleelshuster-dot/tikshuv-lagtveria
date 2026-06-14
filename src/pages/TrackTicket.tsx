import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Hash, Loader2, Search, AlertCircle, Activity, Calendar,
  History, CheckCircle2, ArrowRight, SearchX,
} from "lucide-react";
// Named re-export map so JSX can use the LucideIcons.X pattern during migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LucideIcons: Record<string, any> = {
  Hash, Loader2, Search, AlertCircle, Activity, Calendar,
  History, CheckCircle2, ArrowRight, SearchX,
};
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/contexts/ContentContext";
import { StatusBadge, TicketTimeline } from "@/components/TicketUI";
import { formatError } from "@/utils/errorHandler";

type TicketStatus = "sent" | "in_progress" | "resolved" | "closed";

interface TicketResult {
  ticket_number: string;
  status: TicketStatus;
  created_at: string;
  is_closed_confirmed: boolean;
  updates: { created_at: string; update_text: string }[];
}

const TrackTicket = () => {
  const { content } = useContent();
  const [ticketInput, setTicketInput] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<TicketResult | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = ticketInput.trim().toUpperCase();
    if (!input) { setError("הזן מספר פנייה"); setTicket(null); setSearched(false); return; }
    if (!input.startsWith("TK-")) { setError("מספר פנייה חייב להכיל קידומת TK- (לדוגמה: TK-651295)"); setTicket(null); setSearched(false); return; }
    setError(""); setLoading(true);

    const { data: full, error: fetchErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, status, created_at, is_closed_confirmed")
      .eq("ticket_number", input).single();

    if (fetchErr || !full) { setTicket(null); setSearched(true); setLoading(false); return; }

    const { data: updates } = await supabase
      .from("ticket_updates").select("created_at, update_text")
      .eq("ticket_id", (full as any).id).order("created_at", { ascending: true });

    setTicket({
      ticket_number: (full as any).ticket_number,
      status: (full as any).status as TicketStatus,
      created_at: (full as any).created_at,
      is_closed_confirmed: (full as any).is_closed_confirmed,
      updates: (updates as any[]) || [],
    });
    setSearched(true); setLoading(false);
  };

  const handleConfirmClosure = async () => {
    if (!ticket) return;
    setConfirming(true);
    try {
      const { error: err } = await supabase.rpc("confirm_ticket_closure_public", { p_ticket_number: ticket.ticket_number });
      if (err) throw err;
      setTicket((prev) => prev ? { ...prev, is_closed_confirmed: true } : null);
    } catch (err: any) { setError(formatError(err)); }
    finally { setConfirming(false); }
  };

  return (
    <main className="page-center">
      <div className="relative z-10 form-wrapper-lg">

        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-rubik font-bold text-white tracking-tight leading-tight">
            {content["track_ticket_title"]}
          </h1>
          <p className="text-white/40 font-assistant text-lg sm:text-xl max-w-md mx-auto">
            {content["track_ticket_subtitle"] || "עקוב אחר סטטוס הטיפול בפנייתך בזמן אמת."}
          </p>
        </div>

        {/* Search card */}
        <div className="glass-card p-8 sm:p-10 border-white/10 shadow-2xl space-y-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <label className="field-label">{content["label_ticket_number"]}</label>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="relative flex-1 group">
                <input
                  type="text" value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value)}
                  className="glass-input pr-12 font-mono text-lg"
                  placeholder={content["placeholder_ticket_number"] || "TK-XXXXXX"}
                />
                <LucideIcons.Hash className="icon-md absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
              </div>
              <Button type="submit" className="btn-primary h-14 px-8 rounded-xl text-lg group" disabled={loading}>
                {loading
                  ? <LucideIcons.Loader2 className="icon-lg animate-spin" />
                  : <LucideIcons.Search className="icon-md group-hover:scale-110 transition-transform" />
                }
                <span>{loading ? "מחפש..." : content["btn_search_ticket"]}</span>
              </Button>
            </div>
            {error && (
              <p className="field-error animate-shake">
                <LucideIcons.AlertCircle className="icon-xs" />{error}
              </p>
            )}
          </form>

          {/* Results */}
          {searched && (
            <div className="pt-8 border-t border-white/10 animate-slide-up">
              {ticket ? (
                <div className="space-y-10">
                  {/* Ticket ID + status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">זיהוי פנייה פעיל</span>
                      <h2 className="font-mono text-4xl font-bold text-primary tracking-tighter">{ticket.ticket_number}</h2>
                    </div>
                    <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                  </div>

                  {/* Timeline */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                      <LucideIcons.Activity className="icon-sm text-primary" />מצב הטיפול המבצעי
                    </h3>
                    <div className="bg-white/5 p-8 rounded-3xl border border-white/5 shadow-inner-soft">
                      <TicketTimeline status={ticket.status} />
                    </div>
                  </div>

                  {/* Date opened */}
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold text-white/40 uppercase tracking-widest">
                    <LucideIcons.Calendar className="icon-xs" />
                    נפתחה ב: {formatDate(ticket.created_at)}
                  </div>

                  {/* Updates log */}
                  {ticket.updates.length > 0 && (
                    <div className="space-y-6 pt-4">
                      <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                        <LucideIcons.History className="icon-sm text-primary" />יומן אירועים אחרונים
                      </h3>
                      <div className="space-y-5 relative before:absolute before:right-[7px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                        {ticket.updates.map((u, i) => (
                          <div key={i} className="timeline-entry">
                            <div className="timeline-dot">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            </div>
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 group-hover:border-white/10 transition-all">
                              <p className="text-base font-assistant text-white/80 leading-relaxed">{u.update_text}</p>
                              <span className="text-[10px] text-white/20 font-mono mt-3 block">{formatDate(u.created_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirm closure CTA */}
                  {ticket.status === "closed" && !ticket.is_closed_confirmed && (
                    <div className="mt-10 p-8 rounded-3xl bg-primary/10 border border-primary/20 space-y-6 text-center animate-pulse-soft">
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold text-white">הטיפול בפנייתך הושלם בהצלחה!</h4>
                        <p className="text-white/50 font-assistant">נשמח לאישור סגירה סופי ממך כמשוב על איכות השירות.</p>
                      </div>
                      <Button onClick={handleConfirmClosure} disabled={confirming} className="w-full btn-primary h-16 rounded-2xl text-xl group">
                        {confirming ? <LucideIcons.Loader2 className="icon-lg animate-spin" /> : <LucideIcons.CheckCircle2 className="icon-lg group-hover:scale-110 transition-transform" />}
                        <span>{confirming ? "מאשר סגירה..." : "אשר סגירת פנייה"}</span>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center mx-auto text-destructive opacity-40">
                    <LucideIcons.SearchX className="icon-2xl" />
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

        {/* Back */}
        <div className="text-center">
          <Button asChild variant="ghost" className="text-white/30 hover:text-white rounded-xl">
            <Link to="/" className="flex items-center gap-2">
              <LucideIcons.ArrowRight className="icon-sm" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default TrackTicket;
