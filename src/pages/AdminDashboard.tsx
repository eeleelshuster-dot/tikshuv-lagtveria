import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useContent } from "@/contexts/ContentContext";
import { useIdleDisconnect } from "@/hooks/useIdleDisconnect";

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
  closed: "bg-status-closed text-white",
};

interface Ticket {
  id: string;
  ticket_number: string;
  full_name: string;
  id_number: string;
  phone: string;
  description: string;
  status: TicketStatus;
  assignee_id: string | null;
  created_at: string;
  is_archived: boolean;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    const { data } = await supabase
      .from("tickets")
      .select("id, ticket_number, full_name, id_number, phone, description, status, assignee_id, created_at, is_archived")
      .order("created_at", { ascending: false });
    setTickets((data as any[]) || []);
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
    await supabase.from("ticket_updates").insert({
      ticket_id: selectedTicket.id,
      update_text: newNote.trim(),
      created_by: profile?.id,
    } as any);

    setNewNote("");
    const { data } = await supabase
      .from("ticket_updates")
      .select("id, update_text, created_at, created_by")
      .eq("ticket_id", selectedTicket.id)
      .order("created_at", { ascending: true });
    setTicketUpdates((data as any[]) || []);
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
    if (!window.confirm("האם אתה בטוח שברצונך למחוק פנייה זו לצמיתות? פעולה זו תמחק גם את כל הקבצים המצורפים ואינה הפיכה.")) return;
    
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
    const matchesSearch = !searchQuery || t.ticket_number.includes(searchQuery) || t.full_name.includes(searchQuery) || t.id_number.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
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

        {/* Filters */}
        <div className="bg-card rounded-lg p-4 shadow-lg mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <LucideIcons.Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pr-10 pl-4 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
                placeholder={content["admin_dashboard_search_placeholder"]}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
            >
              <option value="all">{content["admin_dashboard_status_all"]}</option>
              <option value="sent">נשלח</option>
              <option value="in_progress">בטיפול</option>
              <option value="resolved">טופל</option>
              <option value="closed">הפנייה נסגרה</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="bg-card rounded-lg p-8 shadow-lg text-center">
            <p className="text-muted-foreground font-assistant animate-pulse">טוען פניות...</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-card rounded-lg shadow-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">מספר פנייה</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">שם מלא</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">ת.ז.</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">תיאור</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">סטטוס</th>
                    <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors duration-150 cursor-pointer"
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <td className="p-3 font-mono-ticket text-sm text-card-foreground">{ticket.ticket_number}</td>
                      <td className="p-3 font-assistant text-sm text-card-foreground">{ticket.full_name}</td>
                      <td className="p-3 font-mono-ticket text-sm text-card-foreground">{ticket.id_number}</td>
                      <td className="p-3 font-assistant text-sm text-card-foreground max-w-[200px] truncate">{ticket.description}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-rubik font-medium ${statusStyles[ticket.status]}`}>
                          {statusLabels[ticket.status]}
                        </span>
                      </td>
                      <td className="p-3 font-mono-ticket text-xs text-muted-foreground">{formatDate(ticket.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {activeTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-card rounded-lg p-4 shadow-lg border border-border card-hover cursor-pointer"
                  onClick={() => openTicketDetail(ticket)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-ticket text-sm font-bold text-card-foreground">{ticket.ticket_number}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-rubik font-medium ${statusStyles[ticket.status]}`}>
                      {statusLabels[ticket.status]}
                    </span>
                  </div>
                  <p className="font-assistant text-sm text-card-foreground font-medium">{ticket.full_name}</p>
                  <p className="font-assistant text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <LucideIcons.Clock className="w-3 h-3" />
                    <span className="font-mono-ticket">{formatDate(ticket.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>

            {activeTickets.length === 0 && (
              <div className="bg-card rounded-lg p-8 shadow-lg text-center mt-4">
                <p className="text-muted-foreground font-assistant">{content["admin_dashboard_no_tickets"]}</p>
              </div>
            )}
            
            {/* Archive Section */}
            <div className="mt-8 mb-4 flex justify-center">
              <Button 
                variant="outline" 
                onClick={() => setShowArchive(!showArchive)}
                className="font-rubik border-border flex items-center gap-2"
              >
                <LucideIcons.Archive className="w-4 h-4" />
                {showArchive ? "הסתר ארכיון" : "הצג ארכיון"}
              </Button>
            </div>
            
            {showArchive && (
              <div className="animate-fade-in border-t border-border pt-6">
                <h2 className="font-rubik font-bold text-xl mb-4 text-center">ארכיון פניות</h2>
                
                {/* Archived Desktop table */}
                <div className="hidden sm:block bg-card rounded-lg shadow-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">מספר פנייה</th>
                        <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">שם מלא</th>
                        <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">ת.ז.</th>
                        <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">סטטוס</th>
                        <th className="text-right p-3 font-rubik font-semibold text-card-foreground text-sm">תאריך</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors duration-150 cursor-pointer opacity-75"
                          onClick={() => openTicketDetail(ticket)}
                        >
                          <td className="p-3 font-mono-ticket text-sm text-card-foreground">{ticket.ticket_number}</td>
                          <td className="p-3 font-assistant text-sm text-card-foreground">{ticket.full_name}</td>
                          <td className="p-3 font-mono-ticket text-sm text-card-foreground">{ticket.id_number}</td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-full text-xs font-rubik font-medium bg-muted text-muted-foreground border border-border">
                              ארכיון
                            </span>
                          </td>
                          <td className="p-3 font-mono-ticket text-xs text-muted-foreground">{formatDate(ticket.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {archivedTickets.length === 0 && (
                    <div className="p-6 text-center text-muted-foreground font-assistant text-sm">אין פניות בארכיון</div>
                  )}
                </div>

                {/* Archived Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {archivedTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-card/80 rounded-lg p-4 shadow-lg border border-border card-hover cursor-pointer opacity-80"
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono-ticket text-sm font-bold text-card-foreground">{ticket.ticket_number}</span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-rubik font-medium bg-muted text-muted-foreground border border-border">ארכיון</span>
                      </div>
                      <p className="font-assistant text-sm text-card-foreground font-medium">{ticket.full_name}</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <LucideIcons.Clock className="w-3 h-3" />
                        <span className="font-mono-ticket">{formatDate(ticket.created_at)}</span>
                      </div>
                    </div>
                  ))}
                  {archivedTickets.length === 0 && (
                    <div className="bg-card rounded-lg p-6 text-center text-muted-foreground font-assistant text-sm shadow-md">אין פניות בארכיון</div>
                  )}
                </div>
              </div>
            )}
            
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
              {/* Ticket Info */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground font-assistant block">{content["label_fullname"]}</span>
                    <span className="text-card-foreground font-assistant font-medium">{selectedTicket.full_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">{content["label_id"]}</span>
                    <span className="text-card-foreground font-mono-ticket">{selectedTicket.id_number}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">{content["label_phone"]}</span>
                    <span className="text-card-foreground font-mono-ticket">{selectedTicket.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-assistant block">{content["label_date"]}</span>
                    <span className="text-card-foreground font-mono-ticket text-xs">{formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>
                {selectedTicket.description && (
                  <div>
                    <span className="text-muted-foreground font-assistant block text-sm">{content["label_description_short"]}</span>
                    <p className="text-card-foreground font-assistant text-sm mt-1">{selectedTicket.description}</p>
                  </div>
                )}
              </div>

              {/* Status Change */}
              <div className="border-t border-border pt-4">
                <label className="flex items-center gap-2 font-rubik font-semibold text-card-foreground text-sm mb-2">
                  <LucideIcons.Clock className="w-4 h-4" />
                  {content["label_status_change"]}
                </label>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                  disabled={savingStatus || selectedTicket.is_archived}
                  className="w-full h-10 px-4 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
                >
                  <option value="sent">נשלח</option>
                  <option value="in_progress">בטיפול</option>
                  <option value="resolved">טופל</option>
                  <option value="closed">הפנייה נסגרה</option>
                </select>
              </div>

              {/* Technician Assignment */}
              <div className="border-t border-border pt-4">
                <label className="flex items-center gap-2 font-rubik font-semibold text-card-foreground text-sm mb-2">
                  <LucideIcons.UserCheck className="w-4 h-4" />
                  {content["label_technician_assign"]}
                </label>
                <select
                  value={selectedTicket.assignee_id || ""}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  disabled={savingAssignee || selectedTicket.is_archived}
                  className="w-full h-10 px-4 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
                >
                  <option value="">לא משויך</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.role === "admin" ? "מנהל" : "יוצר"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Internal Notes */}
              <div className="border-t border-border pt-4">
                <label className="flex items-center gap-2 font-rubik font-semibold text-card-foreground text-sm mb-2">
                  <LucideIcons.MessageSquare className="w-4 h-4" />
                  {content["label_internal_notes"]}
                </label>
                <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                  {ticketUpdates.map((u) => (
                    <div key={u.id} className="bg-secondary/30 rounded-md p-3">
                      <p className="text-card-foreground font-assistant text-sm">{u.update_text}</p>
                      <span className="text-muted-foreground font-mono-ticket text-xs mt-1 block">{formatDate(u.created_at)}</span>
                    </div>
                  ))}
                  {ticketUpdates.length === 0 && (
                    <p className="text-muted-foreground font-assistant text-sm">{content["msg_no_updates"]}</p>
                  )}
                </div>
                
                {!selectedTicket.is_archived ? (
                  <>
                    <div className="flex gap-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="flex-1 min-h-[60px] px-3 py-2 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150 resize-y"
                        placeholder={content["placeholder_internal_note"]}
                      />
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="mt-2 flex-row-reverse"
                      onClick={handleAddNote}
                      disabled={savingNote || !newNote.trim()}
                    >
                      <LucideIcons.MessageSquare className="mr-1 w-4 h-4" />
                      {savingNote ? content["msg_submitting"] : content["label_add_note"]}
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground font-assistant mt-4">
                    פנייה זו בארכיון והיא לקריאה בלבד. לא ניתן להוסיף הערות חדשות.
                  </p>
                )}
              </div>

              {/* Archive and Delete Controls */}
              <div className="border-t border-border pt-4 mt-8 flex flex-col gap-3">
                {!selectedTicket.is_archived && selectedTicket.status === "closed" && (
                  <Button 
                    variant="outline" 
                    className="w-full font-rubik flex items-center justify-center gap-2 border-primary/20 hover:bg-primary/10 text-primary"
                    onClick={handleArchiveTicket}
                  >
                    <LucideIcons.Archive className="w-4 h-4" />
                    העבר לארכיון
                  </Button>
                )}
                
                {selectedTicket.is_archived && profile?.role === "creator" && (
                  <Button 
                    variant="destructive" 
                    className="w-full font-rubik flex items-center justify-center gap-2"
                    onClick={handlePermanentDelete}
                  >
                    <LucideIcons.Trash2 className="w-4 h-4" />
                    מחיקה לצמיתות
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
