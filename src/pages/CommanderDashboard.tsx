import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { FilterPanel } from "@/components/FilterPanel";
import { format, isSameDay, differenceInDays } from "date-fns";
import { StatusBadge, TicketTimeline } from "@/components/TicketUI";
import { formatError } from "@/utils/errorHandler";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

type TicketStatus = "sent" | "in_progress" | "forwarded" | "resolved" | "closed";

interface Ticket {
  id: string;
  ticket_number: string;
  full_name: string;
  department: string;
  phone: string;
  description: string;
  status: TicketStatus;
  assignee_id: string | null;
  created_at: string;
  is_archived: boolean;
  is_closed_confirmed: boolean;
  ticket_updates?: { created_at: string }[];
}

interface TicketUpdate {
  id: string;
  update_text: string;
  created_at: string;
  created_by: string | null;
}

const CommanderDashboard = () => {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "all";
  const departmentFilter = searchParams.get("department") || "all";
  const dateFilterStr = searchParams.get("date");
  const dateFilter = dateFilterStr ? new Date(dateFilterStr) : undefined;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketUpdates, setTicketUpdates] = useState<TicketUpdate[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});

  const setSearchQuery = (val: string) => updateParams("q", val);
  const setStatusFilter = (val: string) => updateParams("status", val);
  const setDepartmentFilter = (val: string) => updateParams("department", val);
  const setDateFilter = (val: Date | undefined) => updateParams("date", val ? val.toISOString() : "");

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value && value !== "all") {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      return newParams;
    }, { replace: true });
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("id, ticket_number, full_name, department, phone, description, status, assignee_id, created_at, is_archived, is_closed_confirmed, ticket_updates(created_at)")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast({ title: "שגיאה בטעינת פניות", description: formatError(error), variant: "destructive" });
    } else {
      setTickets((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();

    supabase
      .from("profiles")
      .select("id, full_name")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data as any[])?.forEach(p => map[p.id] = p.full_name);
        setStaffMap(map);
      });

    const channel = supabase
      .channel("commander-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTickets((prev) => [payload.new as Ticket, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Ticket;
            setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            if (selectedTicket?.id === updated.id) {
              setSelectedTicket(updated);
            }
          } else if (payload.eventType === 'DELETE') {
            setTickets((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id]);

  const openTicketDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    const { data } = await supabase
      .from("ticket_updates")
      .select("id, update_text, created_at, created_by")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setTicketUpdates((data as any[]) || []);
  };

  const handleConfirmClose = async () => {
    if (!selectedTicket) return;
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ is_closed_confirmed: true })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      await supabase.from("ticket_updates").insert({
        ticket_id: selectedTicket.id,
        update_text: `סגירת פנייה אושרה על ידי מפקד`,
        created_by: profile?.id,
      } as any);

      toast({ title: "סגירת פנייה אושרה בהצלחה" });
      const updated = { ...selectedTicket, is_closed_confirmed: true };
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (e: any) {
      toast({ title: "שגיאה באישור סגירה", description: formatError(e), variant: "destructive" });
    }
  };

  const filtered = tickets.filter((t) => {
    if (t.is_archived) return false;
    const matchesSearch = !searchQuery || t.ticket_number.includes(searchQuery) || t.full_name.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesDept = departmentFilter === "all" || t.department === departmentFilter;
    const matchesDate = !dateFilter || isSameDay(new Date(t.created_at), dateFilter) || (t.ticket_updates && t.ticket_updates.some((u: any) => isSameDay(new Date(u.created_at), dateFilter)));
    return matchesSearch && matchesStatus && matchesDept && matchesDate;
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-gradient-main min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="max-w-7xl mx-auto space-y-10 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold font-rubik text-white tracking-tight flex items-center gap-3">
              <LucideIcons.ShieldCheck className="w-10 h-10 text-primary shadow-glow-primary" />
              {content["commander_dashboard_title"] || "פאנל מפקדים"}
              <span className="text-primary/40 font-mono text-sm align-top ml-2 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">PRO</span>
            </h1>
            <p className="text-white/40 font-assistant text-xl">{content["commander_dashboard_subtitle"] || "מעקב מבצעי אחר פניות וביצועי המדור"}</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 p-3 pr-8 rounded-[2rem] border border-white/10 backdrop-blur-2xl">
            <div className="text-right">
              <span className="text-[10px] text-primary font-bold uppercase tracking-[0.4em] block">{content["commander_badge_label"] || "מפקד מאושר"}</span>
              <span className="text-base font-bold text-white font-assistant">{profile?.full_name || content["commander_badge_fallback"] || "מפקד תורן"}</span>
            </div>
            <div className="h-10 w-px bg-white/10 mx-2" />
            <Button variant="ghost" size="icon" onClick={signOut} className="text-white/30 hover:text-white hover:bg-destructive/20 rounded-2xl w-12 h-12 transition-all">
              <LucideIcons.LogOut className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Operational Metrics */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: content["commander_new_tickets"] || 'פניות חדשות', count: tickets.filter(t => t.status === 'sent').length, icon: LucideIcons.Inbox, color: 'text-status-sent', bg: 'bg-status-sent/10' },
              { label: content["commander_in_progress"] || 'בטיפול המדור', count: tickets.filter(t => t.status === 'in_progress' || t.status === 'forwarded').length, icon: LucideIcons.Activity, color: 'text-status-progress', bg: 'bg-status-progress/10' },
              { label: content["commander_waiting_close"] || 'ממתין לסגירה', count: tickets.filter(t => t.status === 'closed' && !t.is_closed_confirmed).length, icon: LucideIcons.AlertCircle, color: 'text-accent-gold', bg: 'bg-accent-gold/10' },
              { label: content["commander_closed_today"] || 'נסגרו היום', count: tickets.filter(t => t.status === 'closed' && t.is_closed_confirmed && isSameDay(new Date(t.created_at), new Date())).length, icon: LucideIcons.CheckCircle2, color: 'text-status-resolved', bg: 'bg-status-resolved/10' },
            ].map((stat, i) => (
              <div 
                key={i} 
                className="glass-card p-6 flex flex-col items-center justify-center text-center group hover:border-primary/30 transition-all"
              >
                <div className={`p-5 rounded-2xl ${stat.bg} ${stat.color} mb-4 transition-transform group-hover:scale-110`}>
                  <stat.icon className="w-9 h-9" />
                </div>
                <span className="text-4xl font-bold font-mono tracking-tight text-white mb-1 leading-none">{stat.count}</span>
                <span className="text-xs text-white/40 font-assistant font-bold uppercase tracking-widest">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-8">
          <FilterPanel 
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
            dateFilter={dateFilter} setDateFilter={setDateFilter}
            onClearFilters={clearFilters}
          />

          {loading ? (
            <div className="glass-card p-24 text-center">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
              <p className="text-white/30 font-assistant text-xl animate-pulse">מושך נתונים מבצעיים...</p>
            </div>
          ) : (
            <>
              {/* Desktop View Table */}
              <div className="hidden lg:block glass-card overflow-hidden border-white/5 shadow-2xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">{content["commander_table_num"] || "מספר פנייה"}</th>
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">{content["commander_table_user"] || "פרטי פונה"}</th>
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">{content["commander_table_dept"] || "מדור"}</th>
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">{content["commander_table_status"] || "סטטוס ביצוע"}</th>
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">{content["commander_table_date"] || "תאריך פתיחה"}</th>
                      <th className="p-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((ticket) => {
                      const daysOpen = differenceInDays(new Date(), new Date(ticket.created_at));
                      const isStuck = ticket.status === 'in_progress' && daysOpen >= 3;
                      return (
                        <tr
                          key={ticket.id}
                          className={`hover:bg-white/[0.04] transition-all cursor-pointer group ${isStuck ? 'bg-destructive/5' : ''}`}
                          onClick={() => openTicketDetail(ticket)}
                        >
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-bold text-primary px-3 py-1 bg-primary/10 rounded-lg group-hover:shadow-glow-primary transition-all">
                                {ticket.ticket_number}
                              </span>
                              {isStuck && (
                                <Badge variant="destructive" className="h-5 px-2 text-[9px] font-bold uppercase animate-pulse">
                                  תקוע {daysOpen} ימים
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-base">{ticket.full_name}</span>
                              <span className="text-xs text-white/40 font-mono tracking-tighter">{ticket.phone}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <Badge variant="secondary" className="bg-white/5 text-white/60 border-white/10 font-assistant font-bold">
                              {ticket.department}
                            </Badge>
                          </td>
                          <td className="p-6">
                            <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                          </td>
                          <td className="p-6 font-mono text-[11px] text-white/20 uppercase tracking-widest">
                            {formatDate(ticket.created_at)}
                          </td>
                          <td className="p-6 text-left">
                            <LucideIcons.ChevronLeft className="w-5 h-5 text-white/10 group-hover:text-primary transition-all group-hover:translate-x-[-4px]" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-6">
                {filtered.map((ticket) => {
                  const daysOpen = differenceInDays(new Date(), new Date(ticket.created_at));
                  const isStuck = ticket.status === 'in_progress' && daysOpen >= 3;
                  return (
                    <div
                      key={ticket.id}
                      className={`glass-card p-6 border-white/10 active:scale-[0.98] transition-all ${isStuck ? 'border-destructive/40 bg-destructive/5' : ''}`}
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                            {ticket.ticket_number}
                          </span>
                          {isStuck && (
                            <span className="text-[10px] font-bold text-destructive flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertTriangle className="w-3.5 h-3.5" />
                              חריגה
                            </span>
                          )}
                        </div>
                        <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                      </div>
                      
                      <div className="space-y-4">
                        <h4 className="text-xl font-bold text-white">{ticket.full_name}</h4>
                        <p className="text-white/50 text-base font-assistant line-clamp-3 leading-relaxed">
                          {ticket.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-2 text-[10px] text-white/20 font-mono font-bold tracking-widest">
                          <LucideIcons.Calendar className="w-4 h-4" />
                          {formatDate(ticket.created_at)}
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold border-white/10 text-white/40 px-3 py-1">
                          {ticket.department}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="glass-card p-24 text-center animate-fade-in">
                  <LucideIcons.SearchX className="w-16 h-16 text-white/5 mx-auto mb-6" />
                  <p className="text-white/30 font-assistant text-xl italic">{content["commander_no_results"] || "לא נמצאו פניות העונות לקריטריוני החיפוש."}</p>
                  <Button variant="link" onClick={clearFilters} className="text-primary mt-4 font-bold text-lg">
                    {content["commander_btn_clear_filters"] || "אפס את כל המסננים"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex justify-center pt-10 border-t border-white/5">
          <Button asChild variant="ghost" className="text-white/20 hover:text-white transition-all rounded-xl">
            <Link to="/" className="flex items-center gap-2">
              <LucideIcons.ArrowRight className="w-4 h-4" />
              <span>חזרה לדף הבית</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Ticket Detail Side-over */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-card border-l border-white/10 p-0 overflow-y-auto">
          {selectedTicket && (
            <div className="flex flex-col h-full bg-gradient-main">
              <SheetHeader className="p-8 border-b border-white/10 bg-white/5 backdrop-blur-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-2 text-right">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.4em] block">OPERATIONAL INTEL</span>
                    <SheetTitle className="text-3xl font-bold text-white font-rubik">{content["commander_sheet_title"] || "פנייה"} {selectedTicket.ticket_number}</SheetTitle>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <StatusBadge status={selectedTicket.status} isConfirmed={selectedTicket.is_closed_confirmed} />
                    <span className="text-[10px] text-white/30 font-mono font-bold tracking-widest">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-8 space-y-12 flex-1 relative z-10">
                {/* Visual Workflow Stepper */}
                <div className="bg-white/5 rounded-3xl p-8 border border-white/10 shadow-inner-soft">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                    <LucideIcons.Activity className="w-4 h-4 text-primary" />
                    {content["commander_sheet_workflow"] || "תהליך הטיפול המבצעי"}
                  </h3>
                  <TicketTimeline status={selectedTicket.status} />
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <label className="text-[10px] font-bold text-primary/60 uppercase block mb-3 tracking-widest">{content["commander_sheet_user_label"] || "פרטי הפונה"}</label>
                    <p className="text-2xl font-bold text-white mb-1">{selectedTicket.full_name}</p>
                    <p className="text-primary font-mono text-sm tracking-tighter">{selectedTicket.phone}</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <label className="text-[10px] font-bold text-primary/60 uppercase block mb-3 tracking-widest">{content["commander_sheet_dept_label"] || "מדור ויחידה"}</label>
                    <p className="text-2xl font-bold text-white mb-1">{selectedTicket.department}</p>
                    <p className="text-white/40 font-assistant text-sm">
                      {content["commander_sheet_assignee_label"] || "גורם מטפל"}: <span className="text-white/60 font-bold">{selectedTicket.assignee_id ? staffMap[selectedTicket.assignee_id] : 'טרם שויך'}</span>
                    </p>
                  </div>
                </div>

                {/* Content Sections */}
                <div className="space-y-10">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <LucideIcons.FileText className="w-5 h-5 text-primary" />
                      {content["commander_sheet_desc_label"] || "תיאור הפנייה המלא"}
                    </h3>
                    <div className="bg-white/5 p-8 rounded-3xl border border-white/10 leading-relaxed text-white/80 font-assistant text-xl whitespace-pre-wrap shadow-inner-soft">
                      {selectedTicket.description}
                    </div>
                  </div>

                  <div className="space-y-6 pt-10 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <LucideIcons.History className="w-5 h-5 text-primary" />
                      {content["commander_sheet_history_label"] || "יומן אירועים ועדכונים"}
                    </h3>
                    <div className="space-y-8 relative before:absolute before:right-[13px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                      {ticketUpdates.map((u) => (
                        <div key={u.id} className="relative pr-12 animate-fade-in group">
                          <div className="absolute right-0 top-1.5 w-7 h-7 rounded-full bg-card border-4 border-primary/20 flex items-center justify-center transition-all group-hover:border-primary/40">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                          <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                            <p className="text-base text-white/90 font-assistant leading-relaxed">{u.update_text}</p>
                            <div className="flex items-center gap-3 mt-4 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                              <span className="text-primary/60">{u.created_by && staffMap[u.created_by] ? staffMap[u.created_by] : 'מערכת'}</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-white/5" />
                              <span>{formatDate(u.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {ticketUpdates.length === 0 && (
                        <div className="pr-12 italic text-white/10 font-assistant text-lg">
                          {content["commander_sheet_no_history"] || "אין עדכונים רשומים ביומן."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Operational Actions */}
                {selectedTicket.status === "closed" && !selectedTicket.is_closed_confirmed && (
                  <div className="pt-10 sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent pb-8 z-20">
                    <Button 
                      className="w-full btn-primary h-16 text-xl shadow-glow-primary rounded-2xl group"
                      onClick={handleConfirmClose}
                    >
                      <LucideIcons.CheckCircle className="w-6 h-6 mr-2 group-hover:scale-110 transition-transform" />
                      {content["commander_sheet_btn_confirm"] || "אישור סגירת פנייה (חתימת מפקד)"}
                    </Button>
                    <p className="text-center text-[10px] text-white/20 mt-6 font-assistant font-bold uppercase tracking-[0.2em]">
                      {content["commander_sheet_confirm_note"] || "אישור זה הינו סופי ויעביר את הפנייה לארכיון המערכת"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CommanderDashboard;

