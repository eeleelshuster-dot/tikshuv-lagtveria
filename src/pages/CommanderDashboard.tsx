import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { FilterPanel } from "@/components/FilterPanel";
import { format, isSameDay } from "date-fns";
import { StatusBadge, TicketTimeline } from "@/components/TicketUI";
import { formatError } from "@/utils/errorHandler";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";

type TicketStatus = "sent" | "in_progress" | "forwarded" | "resolved" | "closed";

// Replaced by StatusBadge component config

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

interface StaffProfile {
  id: string;
  full_name: string;
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
    <div className="bg-gradient-main min-h-screen px-4 py-6">
      <div className="relative z-10 max-w-6xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-rubik font-bold text-foreground text-xl sm:text-2xl">
            פאנל מפקדים
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <LucideIcons.Shield className="w-5 h-5 text-foreground/60" />
              <span className="text-sm text-foreground/60 font-assistant">{profile?.full_name || "מפקד"}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} title="התנתק" className="text-foreground/60 hover:text-foreground">
              <LucideIcons.LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Metrics Summary Dashboard */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'פניות פתוחות', count: tickets.filter(t => t.status === 'sent').length, icon: LucideIcons.Inbox, color: 'text-status-sent' },
              { label: 'בטיפול שוטף', count: tickets.filter(t => t.status === 'in_progress' || t.status === 'forwarded').length, icon: LucideIcons.Clock, color: 'text-status-progress' },
              { label: 'ממתין לסגירה', count: tickets.filter(t => t.status === 'closed' && !t.is_closed_confirmed).length, icon: LucideIcons.AlertCircle, color: 'text-accent-gold' },
              { label: 'נסגרו היום', count: tickets.filter(t => t.status === 'closed' && t.is_closed_confirmed && isSameDay(new Date(t.created_at), new Date())).length, icon: LucideIcons.CheckCircle2, color: 'text-status-resolved' },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-4 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-top-4" style={{ animationDelay: `${i * 100}ms` }}>
                <stat.icon className={`w-6 h-6 mb-2 ${stat.color}`} />
                <span className="text-2xl font-bold font-mono-ticket">{stat.count}</span>
                <span className="text-xs text-muted-foreground font-assistant">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        <FilterPanel 
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
          dateFilter={dateFilter} setDateFilter={setDateFilter}
          onClearFilters={clearFilters}
        />

        {loading ? (
          <div className="bg-card rounded-lg p-8 shadow-lg text-center">
            <p className="text-muted-foreground font-assistant animate-pulse">טוען פניות...</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block glass-card overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="p-5 font-rubik font-bold text-muted-foreground text-xs uppercase tracking-wider">מספר פנייה</th>
                    <th className="p-5 font-rubik font-bold text-muted-foreground text-xs uppercase tracking-wider">פרטי פונה</th>
                    <th className="p-5 font-rubik font-bold text-muted-foreground text-xs uppercase tracking-wider">מדור</th>
                    <th className="p-5 font-rubik font-bold text-muted-foreground text-xs uppercase tracking-wider">תוכן הפנייה</th>
                    <th className="p-5 font-rubik font-bold text-muted-foreground text-xs uppercase tracking-wider">סטטוס</th>
                    <th className="p-5 font-rubik font-bold text-muted-foreground text-xs uppercase tracking-wider">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => {
                    const isStuck = ticket.status === 'in_progress' && (new Date().getTime() - new Date(ticket.created_at).getTime() > 3 * 24 * 60 * 60 * 1000);
                    return (
                      <tr
                        key={ticket.id}
                        className={`border-b border-border/40 hover:bg-secondary/20 transition-all duration-200 cursor-pointer group ${isStuck ? 'bg-destructive/5' : ''}`}
                        onClick={() => openTicketDetail(ticket)}
                      >
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-ticket text-sm font-bold text-primary group-hover:underline">{ticket.ticket_number}</span>
                            {isStuck && <Badge variant="destructive" className="text-[9px] h-4 px-1 animate-pulse">תקוע</Badge>}
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="flex flex-col">
                            <span className="font-assistant text-sm font-bold">{ticket.full_name}</span>
                            <span className="font-assistant text-[10px] text-muted-foreground">{ticket.phone}</span>
                          </div>
                        </td>
                        <td className="p-5 font-assistant text-sm">{ticket.department}</td>
                        <td className="p-5 font-assistant text-sm max-w-[250px] truncate text-muted-foreground">{ticket.description}</td>
                        <td className="p-5">
                          <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                        </td>
                        <td className="p-5 font-mono-ticket text-[11px] text-muted-foreground">{formatDate(ticket.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-4">
              {filtered.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-card rounded-xl p-5 shadow-lg border border-border card-hover cursor-pointer"
                  onClick={() => openTicketDetail(ticket)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono-ticket text-sm font-bold text-card-foreground">{ticket.ticket_number}</span>
                    <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                  </div>
                  <p className="font-assistant text-sm text-card-foreground font-semibold">{ticket.full_name}</p>
                  <p className="font-assistant text-xs text-muted-foreground mt-2 line-clamp-2">{ticket.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <LucideIcons.Clock className="w-3 h-3" />
                      <span className="font-mono-ticket">{formatDate(ticket.created_at)}</span>
                    </div>
                    {ticket.department && (
                      <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">{ticket.department}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="bg-card rounded-lg p-8 shadow-lg text-center mt-4">
                <p className="text-muted-foreground font-assistant">לא נמצאו פניות תואמות.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ticket Detail Slide-over */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-l border-border p-0 overflow-y-auto">
          {selectedTicket && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-6 border-b border-border bg-secondary/20">
                <div className="flex items-center justify-between">
                  <SheetTitle className="font-rubik text-2xl font-bold">פנייה {selectedTicket.ticket_number}</SheetTitle>
                  <StatusBadge status={selectedTicket.status} isConfirmed={selectedTicket.is_closed_confirmed} />
                </div>
                <SheetDescription className="text-right font-assistant mt-2">
                  מידע מפורט עבור מפקדים.
                </SheetDescription>
              </SheetHeader>

              <div className="p-6 space-y-8 flex-1">
                {/* Visual Timeline */}
                <div className="bg-secondary/10 rounded-xl p-4 border border-border/50">
                  <h3 className="text-sm font-rubik font-bold mb-2 flex items-center gap-2">
                    <LucideIcons.Activity className="w-4 h-4 text-primary" />
                    סטטוס טיפול
                  </h3>
                  <TicketTimeline status={selectedTicket.status} />
                </div>

                <div className="grid grid-cols-2 gap-6 pb-6 border-b border-border">
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">שם מלא</span>
                    <span className="text-card-foreground font-assistant font-bold text-lg">{selectedTicket.full_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">מדור</span>
                    <span className="text-card-foreground font-assistant font-bold text-lg">{selectedTicket.department}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">טלפון</span>
                    <span className="text-card-foreground font-mono-ticket">{selectedTicket.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">תאריך פתיחה</span>
                    <span className="text-card-foreground font-mono-ticket text-sm">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">גורם מטפל</span>
                    <span className="text-card-foreground font-assistant text-sm">
                      {selectedTicket.assignee_id ? staffMap[selectedTicket.assignee_id] || "טוען..." : "לא משויך"}
                    </span>
                  </div>
                </div>

                {selectedTicket.description && (
                  <div>
                    <h3 className="text-sm font-rubik font-bold mb-3 flex items-center gap-2">
                      <LucideIcons.FileText className="w-4 h-4 text-primary" />
                      תיאור הפנייה
                    </h3>
                    <div className="bg-secondary/20 p-4 rounded-lg border border-border/50 italic text-sm font-assistant leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.description}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-rubik font-bold mb-4 flex items-center gap-2">
                    <LucideIcons.History className="w-4 h-4 text-primary" />
                    יומן עדכונים והערות פנימיות
                  </h3>
                  <div className="space-y-4">
                    {ticketUpdates.map((u) => (
                      <div key={u.id} className="relative pr-4 border-r-2 border-primary/20 pb-2">
                        <div className="absolute top-0 -right-1.5 w-3 h-3 rounded-full bg-primary/40" />
                        <p className="text-sm font-assistant text-foreground">{u.update_text}</p>
                        <span className="text-[10px] text-muted-foreground font-mono mt-1 block">
                          {formatDate(u.created_at)} {u.created_by && staffMap[u.created_by] ? `• ${staffMap[u.created_by]}` : ''}
                        </span>
                      </div>
                    ))}
                    {ticketUpdates.length === 0 && (
                      <p className="text-muted-foreground text-xs italic font-assistant">אין עדכונים זמינים</p>
                    )}
                  </div>
                </div>

                {selectedTicket.status === "closed" && !selectedTicket.is_closed_confirmed && (
                  <div className="pt-8 border-t border-border">
                    <Button 
                      className="w-full font-rubik flex items-center justify-center gap-2 py-6 bg-primary hover:bg-primary/90 text-lg shadow-lg"
                      onClick={handleConfirmClose}
                    >
                      <LucideIcons.CheckCircle className="w-5 h-5" />
                      אישור סגירת פנייה (ממתין לסגירה)
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-3 font-assistant italic">
                      אישור זה נדרש על מנת להעביר את הפנייה לארכיון המערכת.
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
