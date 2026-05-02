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
  const { content } = useContent();
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
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

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
      .select("id, full_name, username, role")
      .eq("active", true)
      .then(({ data }) => {
        const staffRoles = ["admin", "creator"];
        const filtered = (data as any[])?.filter(s => staffRoles.includes(s.role));
        setStaffList(filtered || []);
      });

    const channel = supabase
      .channel("admin-tickets")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const newTicket = payload.new as Ticket;
          setTickets((prev) => [newTicket, ...prev]);
          toast({
            title: content["msg_new_ticket_toast"] || "פנייה חדשה התקבלה",
            description: content["msg_new_ticket_body"]
              ?.replace("{number}", newTicket.ticket_number)
              ?.replace("{name}", newTicket.full_name) || `פנייה מספר ${newTicket.ticket_number} מאת ${newTicket.full_name}`,
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
    setUpdatingTicketId(ticketId);
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

      toast({ title: "סטטוס עודכן", description: `הפנייה עברה לסטטוס ${statusLabels[newStatus]}` });
    }
    setUpdatingTicketId(null);
  };

  const handleAssigneeChange = async (ticketId: string, assigneeId: string) => {
    setUpdatingTicketId(ticketId);
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

      toast({ title: "משויך עודכן", description: `הפנייה שויכה ל${assigneeName}` });
    }
    setUpdatingTicketId(null);
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
      toast({ title: "הערה נשמרה בהצלחה" });
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

    setSelectedTicket(null);
    toast({ title: "ארכיון", description: "הפנייה הועברה לארכיון בהצלחה" });
  };

  const handlePermanentDelete = async () => {
    if (!selectedTicket || !selectedTicket.is_archived) return;
    
    try {
      const { data: atts } = await supabase.from('ticket_attachments').select('file_path').eq('ticket_id', selectedTicket.id);
      if (atts && atts.length > 0) {
        await supabase.storage.from('ticket-attachments').remove(atts.map(a => a.file_path));
      }
      
      await supabase.from('audit_logs').insert({
        action: 'permanent_delete',
        entity_type: 'ticket',
        entity_id: selectedTicket.id,
        performed_by: profile?.id,
        details: { ticket_number: selectedTicket.ticket_number }
      } as any);
      
      await supabase.from('tickets').delete().eq('id', selectedTicket.id);
      
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

  const formatDate = (iso: string) => new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-gradient-main min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="max-w-7xl mx-auto space-y-10 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold font-rubik text-white tracking-tight flex items-center gap-3">
              <LucideIcons.ShieldAlert className="w-10 h-10 text-primary shadow-glow-primary" />
              מרכז ניהול מערכת
            </h1>
            <p className="text-white/40 font-assistant text-xl">בקרה תפעולית, ניהול משאבים והרשאות</p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 p-3 pr-8 rounded-3xl border border-white/10 backdrop-blur-xl">
            <div className="text-right">
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest block">ADMINISTRATOR</span>
              <span className="text-base font-bold text-white font-assistant">{profile?.full_name || "מנהל מערכת"}</span>
            </div>
            <div className="h-10 w-px bg-white/10 mx-2" />
            <Button variant="ghost" size="icon" onClick={signOut} className="text-white/30 hover:text-white hover:bg-destructive/20 rounded-2xl w-12 h-12 transition-all">
              <LucideIcons.LogOut className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue="tickets" className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-2xl h-16 w-full md:w-auto backdrop-blur-md">
              <TabsTrigger value="tickets" className="px-10 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-glow-primary transition-all font-rubik font-bold text-base">
                <LucideIcons.Ticket className="w-5 h-5 ml-3" />
                ניהול פניות
              </TabsTrigger>
              <TabsTrigger value="users" className="px-10 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-glow-primary transition-all font-rubik font-bold text-base">
                <LucideIcons.Users className="w-5 h-5 ml-3" />
                ניהול משתמשים
              </TabsTrigger>
            </TabsList>
            
            {/* Contextual Primary Action could go here */}
          </div>

          <TabsContent value="tickets" className="space-y-8 animate-slide-up">
            {/* Operational Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'פניות חדשות', count: tickets.filter(t => t.status === 'sent').length, icon: LucideIcons.Inbox, color: 'text-status-sent', bg: 'bg-status-sent/10' },
                { label: 'בטיפול שוטף', count: tickets.filter(t => t.status === 'in_progress').length, icon: LucideIcons.Activity, color: 'text-status-progress', bg: 'bg-status-progress/10' },
                { label: 'ממתינות לסגירה', count: tickets.filter(t => t.status === 'closed' && !t.is_closed_confirmed).length, icon: LucideIcons.AlertCircle, color: 'text-accent-gold', bg: 'bg-accent-gold/10' },
                { label: 'בארכיון המערכת', count: tickets.filter(t => t.is_archived).length, icon: LucideIcons.Archive, color: 'text-white/40', bg: 'bg-white/5' },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-6 flex items-center gap-6 group hover:border-primary/30 transition-all">
                  <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-3xl font-bold font-mono tracking-tight text-white block leading-none">{stat.count}</span>
                    <span className="text-xs text-white/40 font-assistant font-bold uppercase tracking-wider">{stat.label}</span>
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

            {/* Ticket Management Table */}
            {loading ? (
              <div className="glass-card p-24 text-center">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
                <p className="text-white/30 font-assistant text-xl animate-pulse">מסנכרן נתוני מערכת...</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden border-white/5 shadow-2xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">זיהוי פנייה</th>
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">פונה ומדור</th>
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">סטטוס טיפול</th>
                      <th className="p-6 font-bold text-white/30 text-[11px] uppercase tracking-[0.2em]">גורם משויך</th>
                      <th className="p-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((ticket) => (
                      <tr key={ticket.id} className={`group hover:bg-white/[0.02] transition-colors ${updatingTicketId === ticket.id ? 'opacity-50 pointer-events-none' : ''}`}>
                        <td className="p-6">
                          <div className="flex flex-col gap-1">
                            <span 
                              className="font-mono text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg w-fit cursor-pointer hover:shadow-glow-primary transition-all"
                              onClick={() => openTicketDetail(ticket)}
                            >
                              {ticket.ticket_number}
                            </span>
                            <span className="text-[10px] text-white/20 font-mono tracking-widest uppercase">{formatDate(ticket.created_at)}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-base">{ticket.full_name}</span>
                            <span className="text-xs text-white/40 font-assistant">{ticket.department || "ללא שיוך מדורי"}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <Select 
                            value={ticket.status} 
                            onValueChange={(val) => handleStatusChange(ticket.id, val as TicketStatus)}
                          >
                            <SelectTrigger className="h-11 w-[160px] bg-white/5 border-white/10 rounded-xl font-assistant text-xs font-bold text-white/80 focus:ring-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-white/10 rounded-xl">
                              <SelectItem value="sent" className="font-bold text-status-sent focus:bg-status-sent/10">נשלח</SelectItem>
                              <SelectItem value="in_progress" className="font-bold text-status-progress focus:bg-status-progress/10">בטיפול המדור</SelectItem>
                              <SelectItem value="forwarded" className="font-bold text-accent-gold focus:bg-accent-gold/10">הועבר לגורם אחר</SelectItem>
                              <SelectItem value="resolved" className="font-bold text-status-resolved focus:bg-status-resolved/10">טופל במלואו</SelectItem>
                              <SelectItem value="closed" className="font-bold text-white/40 focus:bg-white/5">סגור / ארכיון</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-6">
                          <Select 
                            value={ticket.assignee_id || "none"} 
                            onValueChange={(val) => handleAssigneeChange(ticket.id, val)}
                          >
                            <SelectTrigger className="h-11 w-[180px] bg-white/5 border-white/10 rounded-xl font-assistant text-xs font-bold text-white/80 focus:ring-primary/20">
                              <div className="flex items-center gap-2">
                                <LucideIcons.UserCheck className="w-3.5 h-3.5 text-primary/60" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="bg-card border-white/10 rounded-xl">
                              <SelectItem value="none" className="italic text-white/40">ללא גורם משויך</SelectItem>
                              {staffList.map((s) => (
                                <SelectItem key={s.id} value={s.id} className="font-bold">{s.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-6 text-left">
                          <Button variant="ghost" size="icon" onClick={() => openTicketDetail(ticket)} className="rounded-xl hover:bg-primary/20 text-white/20 hover:text-primary transition-all">
                            <LucideIcons.ExternalLink className="w-5 h-5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-24 text-center">
                          <LucideIcons.DatabaseBackup className="w-16 h-16 text-white/5 mx-auto mb-6" />
                          <p className="text-white/30 font-assistant text-xl italic">לא נמצאו פניות תואמות במערכת</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="animate-in fade-in slide-in-from-left-6">
            <div className="glass-card p-10 border-white/5">
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold font-rubik text-white">ניהול צוות המדור</h2>
                  <p className="text-white/40 font-assistant">הגדרת משתמשים, הרשאות גישה וסטטוס פעילות</p>
                </div>
                {/* User management primary action could be here */}
              </div>
              <UserManagement session={null} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Enhanced Ticket Detail Sheet */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-card border-l border-white/10 p-0 overflow-y-auto">
          {selectedTicket && (
            <div className="flex flex-col h-full bg-gradient-main">
              <SheetHeader className="p-8 border-b border-white/10 bg-white/5 backdrop-blur-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-2 text-right">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.4em] block">ADMIN CONTROL</span>
                    <SheetTitle className="text-3xl font-bold text-white font-rubik">פנייה {selectedTicket.ticket_number}</SheetTitle>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <StatusBadge status={selectedTicket.status} isConfirmed={selectedTicket.is_closed_confirmed} />
                    <span className="text-[10px] text-white/30 font-mono font-bold tracking-widest">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-8 space-y-12 flex-1 relative z-10">
                {/* Workflow Stepper */}
                <div className="bg-white/5 rounded-3xl p-8 border border-white/10 shadow-inner-soft">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                    <LucideIcons.Zap className="w-4 h-4 text-primary" />
                    מסלול פנייה מבצעי
                  </h3>
                  <TicketTimeline status={selectedTicket.status} />
                </div>

                {/* Core Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <label className="text-[10px] font-bold text-primary/60 uppercase block mb-3 tracking-widest">מגיש הפנייה</label>
                    <p className="text-2xl font-bold text-white mb-1">{selectedTicket.full_name}</p>
                    <p className="text-white/40 font-mono text-sm tracking-tighter">{selectedTicket.phone}</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <label className="text-[10px] font-bold text-primary/60 uppercase block mb-3 tracking-widest">שיוך יחידתי</label>
                    <p className="text-2xl font-bold text-white mb-1">{selectedTicket.department || 'כללי'}</p>
                    <p className="text-white/40 font-assistant text-sm">
                      גורם מטפל: <span className="text-white/60 font-bold">{staffList.find(s => s.id === selectedTicket.assignee_id)?.full_name || 'טרם שויך'}</span>
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <LucideIcons.AlignRight className="w-5 h-5 text-primary" />
                    תוכן הפנייה המקורי
                  </h3>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 italic text-white/80 font-assistant text-xl leading-relaxed whitespace-pre-wrap shadow-inner-soft">
                    "{selectedTicket.description}"
                  </div>
                </div>

                {/* Updates & Notes */}
                <div className="pt-8 border-t border-white/5 space-y-8">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <LucideIcons.MessageSquareQuote className="w-5 h-5 text-primary" />
                    יומן טיפול והערות צוות
                  </h3>
                  
                  <div className="space-y-6">
                    {ticketUpdates.map((u) => (
                      <div key={u.id} className="relative pr-12 animate-fade-in group">
                        <div className="absolute right-0 top-1.5 w-7 h-7 rounded-full bg-card border-4 border-primary/20 flex items-center justify-center transition-all group-hover:border-primary/40">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                          <p className="text-base text-white/90 font-assistant leading-relaxed">{u.update_text}</p>
                          <div className="flex items-center gap-3 mt-4 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                            <span className="text-primary/60">{u.created_by && staffList.find(s => s.id === u.created_by)?.full_name ? staffList.find(s => s.id === u.created_by)?.full_name : 'מערכת'}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/5" />
                            <span>{formatDate(u.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {ticketUpdates.length === 0 && (
                      <div className="pr-12 italic text-white/10 font-assistant text-lg">אין היסטוריית טיפול רשומה כרגע.</div>
                    )}
                  </div>

                  {!selectedTicket.is_archived && (
                    <div className="bg-white/5 p-8 rounded-[2rem] border border-primary/10 shadow-glow-primary/5 space-y-6 mt-12 animate-fade-in">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                          <LucideIcons.Plus className="w-5 h-5" />
                        </div>
                        <h4 className="text-base font-bold text-white">הוספת עדכון חדש</h4>
                      </div>
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="w-full min-h-[120px] p-5 rounded-2xl border border-white/10 bg-black/20 font-assistant text-lg text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all"
                        placeholder="כתוב כאן הערות פנימיות או עדכוני סטטוס..."
                      />
                      <Button
                        className="w-full btn-primary h-14 rounded-xl text-lg group"
                        onClick={handleAddNote}
                        disabled={savingNote || !newNote.trim()}
                      >
                        {savingNote ? <LucideIcons.Loader2 className="w-6 h-6 animate-spin" /> : <LucideIcons.Save className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />}
                        {savingNote ? "מעדכן יומן..." : "שמור עדכון ביומן הטיפול"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Administrative Actions */}
                <div className="pt-12 flex flex-col gap-4">
                  {!selectedTicket.is_archived && selectedTicket.status === "closed" && (
                    <Button 
                      variant="secondary" 
                      className="w-full h-16 rounded-2xl font-bold font-rubik text-lg bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white transition-all flex items-center justify-center gap-3"
                      onClick={handleArchiveTicket}
                    >
                      <LucideIcons.Archive className="w-6 h-6" />
                      העבר פנייה לארכיון המערכת (סופי)
                    </Button>
                  )}
                  
                  {selectedTicket.is_archived && profile?.role === "creator" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full h-16 rounded-2xl font-bold font-rubik text-lg shadow-lg hover:shadow-destructive/20 transition-all gap-4">
                          <LucideIcons.Trash2 className="w-6 h-6" />
                          מחיקה לצמיתות ממאגר הנתונים
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="font-assistant bg-card border-white/10 text-white p-8 rounded-3xl">
                        <AlertDialogHeader className="space-y-4">
                          <AlertDialogTitle className="text-right font-rubik text-3xl font-bold text-destructive flex items-center gap-3">
                            <LucideIcons.ShieldAlert className="w-8 h-8" />
                            אזהרת מחיקה סופית
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-right text-lg text-white/60 leading-relaxed">
                            פעולה זו תמחק את פנייה <span className="text-white font-bold">{selectedTicket.ticket_number}</span> לצמיתות משרתי המערכת, כולל כל הקבצים המצורפים והערות הצוות. <br/><br/>
                            <span className="font-bold text-white">האם אתה בטוח שברצונך להמשיך?</span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row gap-4 mt-10">
                          <AlertDialogCancel className="mt-0 flex-1 h-14 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white/60">ביטול פעולה</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive hover:bg-destructive/80 flex-1 h-14 rounded-xl font-bold text-lg">אישור מחיקה סופית</AlertDialogAction>
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

