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

  const metrics = [
    { label: 'פניות חדשות', count: tickets.filter(t => t.status === 'sent').length, icon: LucideIcons.Inbox, color: 'text-status-sent', bg: 'bg-status-sent/10' },
    { label: 'בטיפול המדור', count: tickets.filter(t => t.status === 'in_progress' || t.status === 'forwarded').length, icon: LucideIcons.Activity, color: 'text-status-progress', bg: 'bg-status-progress/10' },
    { label: 'ממתין לסגירה', count: tickets.filter(t => t.status === 'closed' && !t.is_closed_confirmed).length, icon: LucideIcons.AlertCircle, color: 'text-accent-gold', bg: 'bg-accent-gold/10' },
    { label: 'נסגרו היום', count: tickets.filter(t => t.status === 'closed' && t.is_closed_confirmed && isSameDay(new Date(t.created_at), new Date())).length, icon: LucideIcons.CheckCircle2, color: 'text-status-resolved', bg: 'bg-status-resolved/10' },
  ];

  return (
    <div className="bg-gradient-main min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold font-rubik text-white tracking-tight">
              פאנל מפקדים <span className="text-primary font-mono text-xl align-top ml-2">v2.0</span>
            </h1>
            <p className="text-white/50 font-assistant text-lg">מעקב מבצעי אחר פניות וביצועי המדור</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 p-2 pr-6 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-white/40 uppercase tracking-widest block font-bold">מפקד מחובר</span>
              <span className="text-sm font-bold text-white font-assistant">{profile?.full_name || "מפקד תורן"}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-glow-primary">
              <LucideIcons.ShieldCheck className="w-6 h-6" />
            </div>
            <div className="h-8 w-px bg-white/10 mx-1" />
            <Button variant="ghost" size="icon" onClick={signOut} className="text-white/40 hover:text-white hover:bg-white/10 rounded-xl">
              <LucideIcons.LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Metrics Dashboard */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {metrics.map((stat, i) => (
              <div 
                key={i} 
                className="glass-card p-6 flex flex-col items-center justify-center text-center group hover-lift animate-stagger-1"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} mb-4 transition-transform group-hover:scale-110`}>
                  <stat.icon className="w-8 h-8" />
                </div>
                <span className="text-4xl font-bold font-mono tracking-tight text-white mb-1">{stat.count}</span>
                <span className="text-sm text-white/50 font-assistant font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          <FilterPanel 
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
            dateFilter={dateFilter} setDateFilter={setDateFilter}
            onClearFilters={clearFilters}
          />

          {loading ? (
            <div className="glass-card p-20 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-white/40 font-assistant animate-pulse text-lg">טוען נתונים ממסד הנתונים...</p>
            </div>
          ) : (
            <>
              {/* Desktop View Table */}
              <div className="hidden lg:block glass-card overflow-hidden border-white/5 shadow-2xl animate-slide-up">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="p-5 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">מספר פנייה</th>
                      <th className="p-5 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">פרטי פונה</th>
                      <th className="p-5 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">מדור</th>
                      <th className="p-5 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">סטטוס ביצוע</th>
                      <th className="p-5 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">תאריך פתיחה</th>
                      <th className="p-5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((ticket) => {
                      const daysOpen = differenceInDays(new Date(), new Date(ticket.created_at));
                      const isStuck = ticket.status === 'in_progress' && daysOpen >= 3;
                      return (
                        <tr
                          key={ticket.id}
                          className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${isStuck ? 'bg-destructive/5' : ''}`}
                          onClick={() => openTicketDetail(ticket)}
                        >
                          <td className="p-5">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-sm font-bold text-primary px-3 py-1 bg-primary/10 rounded-lg group-hover:shadow-glow-primary transition-shadow">
                                {ticket.ticket_number}
                              </span>
                              {isStuck && (
                                <Badge variant="destructive" className="h-5 px-2 text-[9px] font-bold uppercase animate-pulse">
                                  תקוע {daysOpen} ימים
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-base">{ticket.full_name}</span>
                              <span className="text-xs text-white/40 font-mono tracking-tighter">{ticket.phone}</span>
                            </div>
                          </td>
                          <td className="p-5">
                            <Badge variant="secondary" className="bg-white/5 text-white/70 border-white/10 font-assistant">
                              {ticket.department}
                            </Badge>
                          </td>
                          <td className="p-5">
                            <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                          </td>
                          <td className="p-5 font-mono text-[11px] text-white/40 uppercase">
                            {formatDate(ticket.created_at)}
                          </td>
                          <td className="p-5 text-left">
                            <LucideIcons.ChevronLeft className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors group-hover:translate-x-[-4px]" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4 animate-slide-up">
                {filtered.map((ticket) => {
                  const daysOpen = differenceInDays(new Date(), new Date(ticket.created_at));
                  const isStuck = ticket.status === 'in_progress' && daysOpen >= 3;
                  return (
                    <div
                      key={ticket.id}
                      className={`glass-card p-5 border-white/10 active:scale-[0.98] transition-all ${isStuck ? 'border-destructive/40 bg-destructive/5' : ''}`}
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            {ticket.ticket_number}
                          </span>
                          {isStuck && (
                            <span className="text-[10px] font-bold text-destructive flex items-center gap-1 animate-pulse">
                              <LucideIcons.AlertTriangle className="w-3 h-3" />
                              חריגת זמנים
                            </span>
                          )}
                        </div>
                        <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="text-lg font-bold text-white">{ticket.full_name}</h4>
                        <p className="text-white/50 text-sm font-assistant line-clamp-2 leading-relaxed">
                          {ticket.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                          <LucideIcons.Calendar className="w-3 h-3" />
                          {formatDate(ticket.created_at)}
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold border-white/10 text-white/40">
                          {ticket.department}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="glass-card p-16 text-center animate-fade-in">
                  <LucideIcons.SearchX className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/50 font-assistant text-lg">לא נמצאו פניות העונות לקריטריוני החיפוש.</p>
                  <Button variant="link" onClick={clearFilters} className="text-primary mt-2">אפס את כל המסננים</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ticket Detail Side-over */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-card border-l border-white/10 p-0 overflow-y-auto">
          {selectedTicket && (
            <div className="flex flex-col h-full bg-gradient-main">
              <SheetHeader className="p-8 border-b border-white/10 bg-white/5 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 text-right">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">מידע פנייה רשמי</span>
                    <SheetTitle className="text-3xl font-bold text-white font-rubik">פנייה {selectedTicket.ticket_number}</SheetTitle>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={selectedTicket.status} isConfirmed={selectedTicket.is_closed_confirmed} />
                    <span className="text-[10px] text-white/30 font-mono">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-8 space-y-10 flex-1 relative z-10">
                {/* Visual Workflow Stepper */}
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10 shadow-inner-soft">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                      <LucideIcons.Activity className="w-4 h-4 text-primary" />
                      תהליך הטיפול המבצעי
                    </h3>
                  </div>
                  <TicketTimeline status={selectedTicket.status} />
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-card p-6 border-white/5">
                    <label className="text-[10px] font-bold text-white/30 uppercase block mb-2">פרטי הפונה</label>
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-white">{selectedTicket.full_name}</p>
                      <p className="text-primary font-mono text-sm">{selectedTicket.phone}</p>
                    </div>
                  </div>
                  <div className="glass-card p-6 border-white/5">
                    <label className="text-[10px] font-bold text-white/30 uppercase block mb-2">מדור ויחידה</label>
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-white">{selectedTicket.department}</p>
                      <p className="text-white/40 text-sm font-assistant">גורם מטפל: {selectedTicket.assignee_id ? staffMap[selectedTicket.assignee_id] : 'טרם שויך'}</p>
                    </div>
                  </div>
                </div>

                {/* Content Sections */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <LucideIcons.FileText className="w-5 h-5 text-primary" />
                      תיאור הפנייה המלא
                    </h3>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 leading-relaxed text-white/80 font-assistant text-lg whitespace-pre-wrap">
                      {selectedTicket.description}
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <LucideIcons.History className="w-5 h-5 text-primary" />
                      יומן אירועים ועדכונים
                    </h3>
                    <div className="space-y-6 relative before:absolute before:right-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                      {ticketUpdates.map((u) => (
                        <div key={u.id} className="relative pr-10 animate-fade-in">
                          <div className="absolute right-0 top-1.5 w-[23px] h-[23px] rounded-full bg-card border-4 border-primary/20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          </div>
                          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <p className="text-sm text-white/90 font-assistant">{u.update_text}</p>
                            <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-white/30 uppercase">
                              <span className="text-primary/60">{u.created_by && staffMap[u.created_by] ? staffMap[u.created_by] : 'מערכת'}</span>
                              <span className="w-1 h-1 rounded-full bg-white/10" />
                              <span>{formatDate(u.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {ticketUpdates.length === 0 && (
                        <div className="pr-10">
                          <p className="text-white/20 italic font-assistant">אין עדכונים רשומים ביומן.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Operational Actions */}
                {selectedTicket.status === "closed" && !selectedTicket.is_closed_confirmed && (
                  <div className="pt-10 sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent pb-8">
                    <Button 
                      className="w-full btn-primary h-16 text-xl shadow-glow-primary rounded-2xl"
                      onClick={handleConfirmClose}
                    >
                      <LucideIcons.CheckCircle className="w-6 h-6" />
                      אישור סגירת פנייה (חתימת מפקד)
                    </Button>
                    <p className="text-center text-[11px] text-white/30 mt-4 font-assistant uppercase tracking-widest">
                      אישור זה הינו סופי ויעביר את הפנייה לארכיון המערכת
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

