import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useContent } from "@/contexts/ContentContext";
import { useIdleDisconnect } from "@/hooks/useIdleDisconnect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FilterPanel } from "@/components/FilterPanel";
import { useSearchParams } from "react-router-dom";
import { isSameDay } from "date-fns";
import { StatusBadge, TicketTimeline } from "@/components/TicketUI";
import { formatError } from "@/utils/errorHandler";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";

type TicketStatus = "sent" | "in_progress" | "resolved" | "closed";

// Replaced by StatusBadge component config

interface Ticket {
  id: string;
  ticket_number: string;
  full_name: string;
  department?: string;
  phone: string;
  description: string;
  status: TicketStatus;
  assignee_id: string | null;
  created_at: string;
  is_archived: boolean;
  is_closed_confirmed?: boolean;
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
  username: string;
  role: string;
}

const AdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const { content, getContentProps } = useContent();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = searchParams.get("q") || "";
  const statusFilter = searchParams.get("status") || "all";
  const departmentFilter = searchParams.get("department") || "all";
  const dateFilterStr = searchParams.get("date");
  const dateFilter = dateFilterStr ? new Date(dateFilterStr) : undefined;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketUpdates, setTicketUpdates] = useState<TicketUpdate[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);

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

  const renderIcon = (iconName: string | undefined, fallback: any) => {
    if (!iconName) return fallback;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="mr-2" /> : fallback;
  };

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
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

    // Fetch staff for assignment dropdown
    supabase
      .from("profiles")
      .select("id, full_name, username, role")
      .eq("active", true)
      .then(({ data }) => {
        // Filter roles in JS to avoid 400 errors from missing enum values in DB
        const staffRoles = ["admin", "creator"];
        const filtered = (data as any[])?.filter(s => staffRoles.includes(s.role));
        setStaffList(filtered || []);
      });

    // Realtime subscription for new tickets
    const channel = supabase
      .channel("admin-tickets")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const newTicket = payload.new as Ticket;
          setTickets((prev) => [newTicket, ...prev]);
          toast({
            title: content["msg_new_ticket_toast"],
            description: content["msg_new_ticket_body"]
              ?.replace("{number}", newTicket.ticket_number)
              ?.replace("{name}", newTicket.full_name),
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload) => {
          const updated = payload.new as Ticket;
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          if (selectedTicket?.id === updated.id) {
            setSelectedTicket(updated);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openTicketDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    const { data } = await supabase
      .from("ticket_updates")
      .select("id, update_text, created_at, created_by")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });
    setTicketUpdates((data as any[]) || []);
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return;
    setSavingStatus(true);
    await supabase
      .from("tickets")
      .update({ status: newStatus } as any)
      .eq("id", selectedTicket.id);

    await supabase.from("ticket_updates").insert({
      ticket_id: selectedTicket.id,
      update_text: `סטטוס שונה ל: ${statusLabels[newStatus]}`,
      created_by: profile?.id,
    } as any);

    setSelectedTicket({ ...selectedTicket, status: newStatus });
    setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: newStatus } : t)));
    
    // Refresh updates
    const { data } = await supabase
      .from("ticket_updates")
      .select("id, update_text, created_at, created_by")
      .eq("ticket_id", selectedTicket.id)
      .order("created_at", { ascending: true });
    setTicketUpdates((data as any[]) || []);
    setSavingStatus(false);
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    if (!selectedTicket) return;
    setSavingAssignee(true);
    const aid = assigneeId || null;
    await supabase
      .from("tickets")
      .update({ assignee_id: aid } as any)
      .eq("id", selectedTicket.id);

    const assigneeName = staffList.find((s) => s.id === assigneeId)?.full_name || "לא משויך";
    await supabase.from("ticket_updates").insert({
      ticket_id: selectedTicket.id,
      update_text: `שויך ל: ${assigneeName}`,
      created_by: profile?.id,
    } as any);

    setSelectedTicket({ ...selectedTicket, assignee_id: aid });
    
    const { data } = await supabase
      .from("ticket_updates")
      .select("id, update_text, created_at, created_by")
      .eq("ticket_id", selectedTicket.id)
      .order("created_at", { ascending: true });
    setTicketUpdates((data as any[]) || []);
    setSavingAssignee(false);
  };

  const handleAddNote = async () => {
    if (!selectedTicket || !newNote.trim()) return;
    setSavingNote(true);
    const { data: newUpdate, error } = await supabase.from("ticket_updates").insert({
      ticket_id: selectedTicket.id,
      update_text: newNote.trim(),
      created_by: profile?.id,
    } as any).select().single();

    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן להוסיף הערה: " + error.message, variant: "destructive" });
    } else if (newUpdate) {
      setTicketUpdates((prev) => [...prev, newUpdate]);
      setNewNote("");
    }
    
    setSavingNote(false);
  };

  const handleArchiveTicket = async () => {
    if (!selectedTicket || selectedTicket.status !== "closed") return;
    
    await supabase
      .from("tickets")
      .update({ is_archived: true } as any)
      .eq("id", selectedTicket.id);

    await supabase.from("ticket_updates").insert({
      ticket_id: selectedTicket.id,
      update_text: `הפנייה הועברה לארכיון`,
      created_by: profile?.id,
    } as any);

    setSelectedTicket({ ...selectedTicket, is_archived: true });
    setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? { ...t, is_archived: true } : t)));
    setSelectedTicket(null); // Close the detail view
    toast({ title: "ארכיון", description: "הפנייה הועברה לארכיון בהצלחה" });
  };

  const handlePermanentDelete = async () => {
    if (!selectedTicket || !selectedTicket.is_archived) return;
    
    try {
      // Fetch attachments to delete them from storage
      const { data: atts } = await supabase.from('ticket_attachments').select('file_path').eq('ticket_id', selectedTicket.id);
      
      if (atts && atts.length > 0) {
        await supabase.storage.from('ticket-attachments').remove(atts.map(a => a.file_path));
      }
      
      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'permanent_delete',
        entity_type: 'ticket',
        entity_id: selectedTicket.id,
        performed_by: profile?.id,
        details: { ticket_number: selectedTicket.ticket_number }
      } as any);
      
      // Delete from DB
      await supabase.from('tickets').delete().eq('id', selectedTicket.id);
      
      setTickets((prev) => prev.filter((t) => t.id !== selectedTicket.id));
      setSelectedTicket(null);
      toast({ title: "נמחק", description: "הפנייה נמחקה לצמיתות." });
    } catch (e: any) {
      toast({ title: "שגיאה", description: "אירעה שגיאה במחיקת הפנייה: " + e.message, variant: "destructive" });
    }
  };

  const filtered = tickets.filter((t) => {
    const matchesSearch = !searchQuery || t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) || t.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesDept = departmentFilter === "all" || t.department === departmentFilter;
    const matchesDate = !dateFilter || isSameDay(new Date(t.created_at), dateFilter) || (t.ticket_updates && t.ticket_updates.some((u: any) => isSameDay(new Date(u.created_at), dateFilter)));
    const matchesArchive = showArchive ? true : !t.is_archived;
    return matchesSearch && matchesStatus && matchesDept && matchesDate && matchesArchive;
  });

  const activeTickets = filtered.filter(t => !t.is_archived);
  const archivedTickets = filtered.filter(t => t.is_archived);

  const formatDate = (iso: string) => new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-gradient-main min-h-screen px-4 py-6">
      <div className="relative z-10 max-w-6xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className={`font-rubik font-bold text-foreground ${getStyle("admin_dashboard_title") || "text-xl sm:text-2xl"}`}>
            {content["admin_dashboard_title"]}
          </h1>
          <div className="flex items-center gap-3">
            {profile?.role === "creator" && (
              <Button asChild variant="outline" size="sm" className="hidden sm:flex flex-row-reverse border-border/50 text-foreground/80 hover:text-foreground hover:bg-secondary/50">
                <Link to="/creator">
                  <span>לוח יוצר</span>
                  <LucideIcons.Settings className="mr-2 w-4 h-4" />
                </Link>
              </Button>
            )}
            <div className="flex items-center gap-2">
              <LucideIcons.User className="w-5 h-5 text-foreground/60" />
              <span className="text-sm text-foreground/60 font-assistant">{profile?.full_name || "מנהל"}</span>
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
          showArchived={showArchive} setShowArchived={setShowArchive}
          onClearFilters={clearFilters}
        />

        {loading ? (
          <div className="bg-card rounded-lg p-8 shadow-lg text-center">
            <p className="text-muted-foreground font-assistant animate-pulse">טוען פניות...</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-card rounded-lg shadow-lg overflow-hidden border border-border/50">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="p-4 font-rubik font-semibold text-card-foreground text-sm">מספר פנייה</th>
                    <th className="p-4 font-rubik font-semibold text-card-foreground text-sm">שם מלא</th>
                    <th className="p-4 font-rubik font-semibold text-card-foreground text-sm">מדור</th>
                    <th className="p-4 font-rubik font-semibold text-card-foreground text-sm">תיאור</th>
                    <th className="p-4 font-rubik font-semibold text-card-foreground text-sm">סטטוס</th>
                    <th className="p-4 font-rubik font-semibold text-card-foreground text-sm">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className={`border-b border-border/50 hover:bg-secondary/30 transition-colors duration-150 cursor-pointer ${ticket.is_archived ? 'opacity-60 bg-muted/20' : ''}`}
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <td className="p-4 font-mono-ticket text-sm text-card-foreground">{ticket.ticket_number}</td>
                      <td className="p-4 font-assistant text-sm text-card-foreground">{ticket.full_name}</td>
                      <td className="p-4 font-assistant text-sm text-card-foreground">{ticket.department}</td>
                      <td className="p-4 font-assistant text-sm text-card-foreground max-w-[200px] truncate">{ticket.description}</td>
                      <td className="p-4">
                        <StatusBadge status={ticket.status} isConfirmed={ticket.is_closed_confirmed} />
                      </td>
                      <td className="p-4 font-mono-ticket text-xs text-muted-foreground">{formatDate(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground font-assistant">{content["admin_dashboard_no_tickets"]}</p>
                </div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-4">
              {filtered.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`bg-card rounded-xl p-5 shadow-lg border border-border card-hover cursor-pointer ${ticket.is_archived ? 'opacity-70 grayscale-[0.3]' : ''}`}
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
              {filtered.length === 0 && (
                <div className="bg-card rounded-lg p-8 shadow-lg text-center">
                  <p className="text-muted-foreground font-assistant">{content["admin_dashboard_no_tickets"]}</p>
                </div>
              )}
            </div>
            

            
          </>
        )}

        <div className="text-center mt-8">
          <Button asChild variant="ghost" className="text-foreground/70 hover:text-foreground">
            <Link to="/">
              <LucideIcons.ArrowRight className="ml-2" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
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
                  פרטי הפנייה המלאים, היסטוריית טיפול ועדכונים פנימיים.
                </SheetDescription>
              </SheetHeader>

              <div className="p-6 space-y-8 flex-1">
                {/* Visual Timeline */}
                <div className="bg-secondary/10 rounded-xl p-4 border border-border/50">
                  <h3 className="text-sm font-rubik font-bold mb-2 flex items-center gap-2">
                    <LucideIcons.Activity className="w-4 h-4 text-primary" />
                    סטטוס טיפול נוכחי
                  </h3>
                  <TicketTimeline status={selectedTicket.status} />
                </div>

                {/* Ticket Info Grid */}
                <div className="grid grid-cols-2 gap-6 pb-6 border-b border-border">
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">מאת</span>
                    <span className="text-card-foreground font-assistant font-bold text-lg">{selectedTicket.full_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">מדור</span>
                    <span className="text-card-foreground font-assistant font-bold text-lg">{selectedTicket.department}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">טלפון ליצירת קשר</span>
                    <span className="text-card-foreground font-mono-ticket text-md">{selectedTicket.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-assistant block mb-1">תאריך פתיחה</span>
                    <span className="text-card-foreground font-mono-ticket text-sm">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>

                {/* Description Box */}
                <div>
                  <h3 className="text-sm font-rubik font-bold mb-3 flex items-center gap-2">
                    <LucideIcons.FileText className="w-4 h-4 text-primary" />
                    תיאור הפנייה
                  </h3>
                  <div className="bg-secondary/20 p-4 rounded-lg border border-border/50 italic text-sm font-assistant leading-relaxed">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Management Controls */}
                {!selectedTicket.is_archived && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-rubik font-bold text-muted-foreground block">עדכון סטטוס</label>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                        disabled={savingStatus}
                        className="w-full h-10 px-3 rounded-md border border-border bg-input font-assistant text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="sent">נשלח</option>
                        <option value="in_progress">בטיפול המדור</option>
                        <option value="forwarded">הועבר לגורם רלוונטי</option>
                        <option value="resolved">טופל</option>
                        <option value="closed">הפנייה נסגרה</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-rubik font-bold text-muted-foreground block">שיוך טכנאי/מטפל</label>
                      <select
                        value={selectedTicket.assignee_id || ""}
                        onChange={(e) => handleAssigneeChange(e.target.value)}
                        disabled={savingAssignee}
                        className="w-full h-10 px-3 rounded-md border border-border bg-input font-assistant text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="">לא משויך</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Updates Log */}
                <div className="pt-6 border-t border-border">
                  <h3 className="text-sm font-rubik font-bold mb-4 flex items-center gap-2">
                    <LucideIcons.History className="w-4 h-4 text-primary" />
                    יומן עדכונים והערות
                  </h3>
                  <div className="space-y-4 mb-6">
                    {ticketUpdates.map((u) => (
                      <div key={u.id} className="relative pr-4 border-r-2 border-primary/20 pb-2">
                        <div className="absolute top-0 -right-1.5 w-3 h-3 rounded-full bg-primary/40" />
                        <p className="text-sm font-assistant text-foreground">{u.update_text}</p>
                        <span className="text-[10px] text-muted-foreground font-mono mt-1 block">{formatDate(u.created_at)}</span>
                      </div>
                    ))}
                    {ticketUpdates.length === 0 && (
                      <p className="text-muted-foreground text-xs italic">אין עדכונים זמינים</p>
                    )}
                  </div>

                  {!selectedTicket.is_archived && (
                    <div className="space-y-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="w-full min-h-[80px] p-3 rounded-md border border-border bg-input font-assistant text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                        placeholder="הוסף הערה פנימית חדשה..."
                      />
                      <Button
                        size="sm"
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                        onClick={handleAddNote}
                        disabled={savingNote || !newNote.trim()}
                      >
                        {savingNote ? "מעדכן..." : "שמור הערה"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Destructive Actions */}
                <div className="pt-8 flex flex-col gap-3">
                  {!selectedTicket.is_archived && selectedTicket.status === "closed" && (
                    <Button 
                      variant="secondary" 
                      className="w-full font-rubik flex items-center justify-center gap-2"
                      onClick={handleArchiveTicket}
                    >
                      <LucideIcons.Archive className="w-4 h-4" />
                      העבר לארכיון המערכת
                    </Button>
                  )}
                  
                  {selectedTicket.is_archived && profile?.role === "creator" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full font-rubik gap-2">
                          <LucideIcons.Trash2 className="w-4 h-4" />
                          מחיקה לצמיתות מהמערכת
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="font-assistant">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-right font-rubik">פעולה בלתי הפיכה</AlertDialogTitle>
                          <AlertDialogDescription className="text-right">
                            האם אתה בטוח שברצונך למחוק את פנייה {selectedTicket.ticket_number} לצמיתות?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row gap-2">
                          <AlertDialogCancel className="mt-0 flex-1">ביטול</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive flex-1">אישור מחיקה</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminDashboard;
