import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { FilterPanel } from "@/components/FilterPanel";
import { format, isSameDay } from "date-fns";

type TicketStatus = "sent" | "in_progress" | "forwarded" | "resolved" | "closed";

const statusLabels: Record<string, string> = {
  sent: "נשלח",
  in_progress: "בטיפול המדור",
  forwarded: "הועבר לגורם הרלוונטי",
  resolved: "טופל",
  closed: "הפנייה נסגרה",
};

const statusStyles: Record<string, string> = {
  sent: "bg-status-sent/20 text-status-sent",
  in_progress: "bg-status-progress/20 text-status-progress",
  forwarded: "bg-blue-500/20 text-blue-600",
  resolved: "bg-status-resolved/20 text-status-resolved",
  closed: "bg-status-closed text-white",
};

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
    const { data } = await supabase
      .from("tickets")
      .select("id, ticket_number, full_name, department, phone, description, status, assignee_id, created_at, is_archived, is_closed_confirmed, ticket_updates(created_at)")
      .order("created_at", { ascending: false });
    setTickets((data as any[]) || []);
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
      toast({ title: "שגיאה באישור סגירה", description: e.message, variant: "destructive" });
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
            <div className="hidden sm:block bg-card rounded-lg shadow-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">מספר פנייה</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">שם מלא</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">מדור</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">תיאור</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">סטטוס</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors duration-150 cursor-pointer"
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <td className="p-3 font-mono-ticket text-sm text-card-foreground">{ticket.ticket_number}</td>
                      <td className="p-3 font-assistant text-sm text-card-foreground">{ticket.full_name}</td>
                      <td className="p-3 font-assistant text-sm text-card-foreground">{ticket.department}</td>
                      <td className="p-3 font-assistant text-sm text-card-foreground max-w-[200px] truncate">{ticket.description}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-rubik font-medium ${statusStyles[ticket.status] || ''}`}>
                          {statusLabels[ticket.status] || ticket.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono-ticket text-xs text-muted-foreground">{formatDate(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-3">
              {filtered.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-card rounded-lg p-4 shadow-lg border border-border card-hover cursor-pointer"
                  onClick={() => openTicketDetail(ticket)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-ticket text-sm font-bold text-card-foreground">{ticket.ticket_number}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-rubik font-medium ${statusStyles[ticket.status] || ''}`}>
                      {statusLabels[ticket.status] || ticket.status}
                    </span>
                  </div>
                  <p className="font-assistant text-sm text-card-foreground font-medium">{ticket.full_name} ({ticket.department})</p>
                  <p className="font-assistant text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <LucideIcons.Clock className="w-3 h-3" />
                    <span className="font-mono-ticket">{formatDate(ticket.created_at)}</span>
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

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedTicket(null)} />
          <div className="relative w-full max-w-lg bg-card shadow-2xl overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
              <h2 className="font-rubik font-bold text-card-foreground text-lg">פנייה {selectedTicket.ticket_number}</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)}>
                <LucideIcons.X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-6">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground font-assistant block">שם מלא</span>
                    <span className="text-card-foreground font-assistant font-medium">{selectedTicket.full_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">מדור</span>
                    <span className="text-card-foreground font-assistant">{selectedTicket.department}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">טלפון</span>
                    <span className="text-card-foreground font-mono-ticket">{selectedTicket.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">תאריך</span>
                    <span className="text-card-foreground font-mono-ticket text-xs">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">סטטוס</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-rubik ${statusStyles[selectedTicket.status] || ''}`}>
                      {statusLabels[selectedTicket.status] || selectedTicket.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">גורם מטפל</span>
                    <span className="text-card-foreground font-assistant text-xs">
                      {selectedTicket.assignee_id ? staffMap[selectedTicket.assignee_id] || "טוען..." : "לא משויך"}
                    </span>
                  </div>
                </div>
                {selectedTicket.description && (
                  <div className="mt-4">
                    <span className="text-muted-foreground font-assistant block text-sm">תיאור הפנייה</span>
                    <p className="text-card-foreground font-assistant text-sm mt-1 p-3 bg-secondary/30 rounded-md whitespace-pre-wrap">
                      {selectedTicket.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <label className="flex items-center gap-2 font-rubik font-semibold text-card-foreground text-sm mb-2">
                  <LucideIcons.MessageSquare className="w-4 h-4" />
                  הערות פנימיות
                </label>
                <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                  {ticketUpdates.map((u) => (
                    <div key={u.id} className="bg-secondary/30 rounded-md p-3">
                      <p className="text-card-foreground font-assistant text-sm">{u.update_text}</p>
                      <span className="text-muted-foreground font-mono-ticket text-xs mt-1 block">
                        {formatDate(u.created_at)} {u.created_by && staffMap[u.created_by] ? `• ${staffMap[u.created_by]}` : ''}
                      </span>
                    </div>
                  ))}
                  {ticketUpdates.length === 0 && (
                    <p className="text-muted-foreground font-assistant text-sm">אין עדכונים או הערות לפנייה זו.</p>
                  )}
                </div>
              </div>

              {selectedTicket.status === "closed" && !selectedTicket.is_closed_confirmed && (
                <div className="border-t border-border pt-4 mt-8">
                  <Button 
                    className="w-full font-rubik flex items-center justify-center gap-2"
                    onClick={handleConfirmClose}
                  >
                    <LucideIcons.CheckCircle className="w-4 h-4" />
                    אישור סגירת פנייה (ממתין לסגירה)
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommanderDashboard;
