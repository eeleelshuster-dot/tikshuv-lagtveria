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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/creator/UserManagement";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabels: Record<string, string> = {
  sent: "נשלח",
  in_progress: "בטיפול המדור",
  forwarded: "הועבר לגורם הרלוונטי",
  resolved: "טופל",
  closed: "הפנייה נסגרה",
};

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

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    setSavingStatus(true);
    const { error } = await supabase
      .from("tickets")
      .update({ status: newStatus } as any)
      .eq("id", ticketId);

    if (error) {
      toast({ title: "שגיאה בעדכון סטטוס", description: formatError(error), variant: "destructive" });
    } else {
      await supabase.from("ticket_updates").insert({
        ticket_id: ticketId,
        update_text: `סטטוס שונה ל: ${statusLabels[newStatus] || newStatus}`,
        created_by: profile?.id,
      } as any);

      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
      toast({ title: "סטטוס עודכן בהצלחה" });
    }
    setSavingStatus(false);
  };

  const handleAssigneeChange = async (ticketId: string, assigneeId: string) => {
    setSavingAssignee(true);
    const aid = assigneeId === "none" ? null : assigneeId;
    const { error } = await supabase
      .from("tickets")
      .update({ assignee_id: aid } as any)
      .eq("id", ticketId);

    if (error) {
      toast({ title: "שגיאה בשינוי משויך", description: formatError(error), variant: "destructive" });
    } else {
      const assigneeName = staffList.find((s) => s.id === aid)?.full_name || "לא משויך";
      await supabase.from("ticket_updates").insert({
        ticket_id: ticketId,
        update_text: `שויך ל: ${assigneeName}`,
        created_by: profile?.id,
      } as any);

      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, assignee_id: aid } : t)));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, assignee_id: aid });
      }
      toast({ title: "משויך עודכן בהצלחה" });
    }
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
    const matchesArchive = showArchive ? t.is_archived : !t.is_archived;
    return matchesSearch && matchesStatus && matchesDept && matchesDate && matchesArchive;
  });

  const activeTickets = filtered.filter(t => !t.is_archived);
  const archivedTickets = filtered.filter(t => t.is_archived);

  const formatDate = (iso: string) => new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-gradient-main min-h-screen px-4 py-8">
      <div className="relative z-10 max-w-7xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-rubik font-bold text-foreground text-3xl">לוח מנהל מערכת</h1>
            <p className="text-muted-foreground font-assistant mt-1">ניהול פניות, משתמשים והרשאות</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-secondary/20 px-3 py-1.5 rounded-full border border-border/30">
              <LucideIcons.Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-assistant font-bold">{profile?.full_name || "מנהל"}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} title="התנתק" className="text-muted-foreground hover:text-foreground">
              <LucideIcons.LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Unified Dashboard Tabs */}
        <Tabs defaultValue="tickets" className="space-y-8">
          <TabsList className="bg-secondary/20 border border-border/30 p-1 rounded-xl h-14">
            <TabsTrigger value="tickets" className="px-8 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-rubik font-bold">
              <LucideIcons.Ticket className="w-4 h-4 ml-2" />
              ניהול פניות
            </TabsTrigger>
            <TabsTrigger value="users" className="px-8 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-rubik font-bold">
              <LucideIcons.Users className="w-4 h-4 ml-2" />
              ניהול משתמשים
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            {/* Quick Summary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'פניות חדשות', count: tickets.filter(t => t.status === 'sent').length, icon: LucideIcons.Inbox, color: 'text-status-sent' },
                { label: 'בטיפול', count: tickets.filter(t => t.status === 'in_progress').length, icon: LucideIcons.Clock, color: 'text-status-progress' },
                { label: 'טופלו', count: tickets.filter(t => t.status === 'resolved').length, icon: LucideIcons.CheckCircle, color: 'text-status-resolved' },
                { label: 'ארכיון', count: tickets.filter(t => t.is_archived).length, icon: LucideIcons.Archive, color: 'text-muted-foreground' },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-5 flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-secondary/30 ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-2xl font-bold font-mono-ticket block leading-none">{stat.count}</span>
                    <span className="text-xs text-muted-foreground font-assistant mt-1">{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <FilterPanel 
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter}
              dateFilter={dateFilter} setDateFilter={setDateFilter}
              onClearFilters={clearFilters}
              showArchived={showArchive}
              setShowArchived={setShowArchive}
            />

            {loading ? (
              <div className="glass-card p-12 text-center">
                <p className="text-muted-foreground font-assistant animate-pulse">טוען פניות מערכת...</p>
              </div>
            ) : (
              <div className="lg:block glass-card overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/30">
                      <th className="p-4 font-rubik font-bold text-muted-foreground text-xs uppercase">פנייה</th>
                      <th className="p-4 font-rubik font-bold text-muted-foreground text-xs uppercase">פונה ומדור</th>
                      <th className="p-4 font-rubik font-bold text-muted-foreground text-xs uppercase">סטטוס טיפול</th>
                      <th className="p-4 font-rubik font-bold text-muted-foreground text-xs uppercase">גורם משויך</th>
                      <th className="p-4 font-rubik font-bold text-muted-foreground text-xs uppercase">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ticket) => (
                        <tr key={ticket.id} className="border-b border-border/40 hover:bg-secondary/10 transition-colors group">
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-mono-ticket text-sm font-bold text-primary group-hover:underline cursor-pointer" onClick={() => openTicketDetail(ticket)}>{ticket.ticket_number}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDate(ticket.created_at)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-assistant text-sm font-bold">{ticket.full_name}</span>
                              <span className="text-xs text-muted-foreground">{ticket.department || "ללא מדור"}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Select 
                              value={ticket.status} 
                              onValueChange={(val) => handleStatusChange(ticket.id, val as TicketStatus)}
                            >
                              <SelectTrigger className="h-9 w-[140px] bg-secondary/20 border-border/40 font-assistant text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sent">נשלח</SelectItem>
                                <SelectItem value="in_progress">בטיפול</SelectItem>
                                <SelectItem value="forwarded">הועבר</SelectItem>
                                <SelectItem value="resolved">טופל</SelectItem>
                                <SelectItem value="closed">סגור</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-4">
                            <Select 
                              value={ticket.assignee_id || "none"} 
                              onValueChange={(val) => handleAssigneeChange(ticket.id, val)}
                            >
                              <SelectTrigger className="h-9 w-[160px] bg-secondary/20 border-border/40 font-assistant text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">לא משויך</SelectItem>
                                {staffList.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-4">
                            <Button variant="ghost" size="sm" onClick={() => openTicketDetail(ticket)} className="hover:bg-primary/10 text-primary">
                              <LucideIcons.ExternalLink className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-muted-foreground font-assistant italic">
                          לא נמצאו פניות תואמות לחיפוש זה.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="animate-in fade-in slide-in-from-left-4">
            <div className="glass-card p-6">
              <UserManagement session={null} />
            </div>
          </TabsContent>
        </Tabs>
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
