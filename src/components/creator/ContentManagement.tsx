import { useState } from "react";
import { useContent, ContentProperties } from "@/contexts/ContentContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings2, 
  Save, 
  Type, 
  AlignCenter, 
  AlignRight, 
  AlignLeft, 
  ChevronDown, 
  ChevronUp,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown
} from "lucide-react";

const FONT_SIZES = [
  { label: "קטן", value: "text-sm" },
  { label: "רגיל", value: "text-base" },
  { label: "בינוני", value: "text-lg" },
  { label: "גדול", value: "text-xl" },
  { label: "גדול מאוד", value: "text-2xl" },
  { label: "ענק", value: "text-3xl" },
  { label: "כותרת ענק", value: "text-4xl" },
];

const ALIGNMENTS = [
  { label: "ימין", value: "text-right", icon: AlignRight },
  { label: "מרכז", value: "text-center", icon: AlignCenter },
  { label: "שמאל", value: "text-left", icon: AlignLeft },
];

export const ContentManagement = () => {
  const { content, getContentProps, updateContent } = useContent();
  const { toast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  
  // Local state for the item being edited
  const [editValue, setEditValue] = useState("");
  const [editProps, setEditProps] = useState<ContentProperties>({});
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (key: string) => {
    setEditingKey(key);
    setEditValue(content[key] || "");
    setEditProps(getContentProps(key));
  };

  const handleSave = async (key: string) => {
    setIsSaving(true);
    try {
      await updateContent(key, editValue, editProps);
      toast({ title: "התוכן עודכן בהצלחה" });
      setEditingKey(null);
    } catch (err) {
      toast({ title: "שגיאה בעדכון התוכן", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const categories = [
    { name: "דף הבית", keys: ["home_hero_title", "home_hero_subtitle", "home_btn_open", "home_btn_track", "home_link_admin", "home_footer_credit"] },
    { name: "פתיחת פנייה", keys: ["open_ticket_title", "open_ticket_subtitle", "label_fullname", "label_id_number", "label_phone", "label_description", "placeholder_fullname", "placeholder_id_number", "placeholder_phone", "placeholder_description", "btn_submit_ticket", "btn_back_home", "msg_submitting", "msg_ticket_success_title", "msg_ticket_number_label", "msg_ticket_success_save_number"] },
    { name: "מעקב פנייה", keys: ["track_ticket_title", "track_ticket_subtitle", "label_ticket_number", "placeholder_ticket_number", "btn_search_ticket", "label_ticket_status", "label_ref_name", "label_ref_description", "label_recent_updates", "msg_no_updates"] },
    { name: "כניסת מנהל וסיסמה", keys: ["admin_login_title", "label_username", "label_password", "placeholder_username", "placeholder_password", "checkbox_remember", "btn_login", "msg_logging_in", "change_password_title", "change_password_subtitle", "label_new_password", "label_confirm_password", "placeholder_new_password", "placeholder_confirm_password", "msg_passwords_match", "btn_save_password", "msg_password_min_length", "msg_passwords_dont_match", "msg_saving"] },
    { name: "לוח מנהל", keys: ["admin_dashboard_title", "admin_dashboard_subtitle", "admin_dashboard_search_placeholder", "admin_dashboard_status_all", "admin_dashboard_no_tickets", "label_id", "label_date", "label_description_short", "label_status_change", "label_technician_assign", "label_internal_notes", "label_add_note", "placeholder_internal_note", "msg_new_ticket_toast", "msg_new_ticket_body"] },
    { name: "פאנל מפקדים", keys: ["commander_dashboard_title", "commander_dashboard_subtitle", "commander_badge_label", "commander_new_tickets", "commander_in_progress", "commander_waiting_close", "commander_closed_today", "commander_table_num", "commander_table_user", "commander_table_dept", "commander_table_status", "commander_table_date", "commander_no_results", "commander_btn_clear_filters", "commander_sheet_title", "commander_sheet_workflow", "commander_sheet_user_label", "commander_sheet_dept_label", "commander_sheet_assignee_label", "commander_sheet_desc_label", "commander_sheet_history_label", "commander_sheet_no_history", "commander_sheet_btn_confirm", "commander_sheet_confirm_note"] },
    { name: "אחר", keys: ["not_found_title", "not_found_subtitle"] }
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 border-white/10 bg-white/5">
        <h2 className="text-2xl font-rubik font-bold text-white">ניהול תוכן ועיצוב (CMS)</h2>
        <p className="text-base font-assistant text-white/40">עריכת טקסטים, גדלים ומיקומים בכל האתר</p>
      </div>

      {categories.map((cat) => (
        <div key={cat.name} className="space-y-4">
          <h3 className="font-rubik font-bold text-xl text-primary border-b border-white/10 pb-2 flex items-center gap-2">
            <LucideIcons.Settings2 className="w-5 h-5" />
            {cat.name}
          </h3>
          <div className="grid gap-4">
            {cat.keys.map((key) => {
              const isEditing = editingKey === key;
              const isExpanded = expandedKey === key;
              const props = isEditing ? editProps : getContentProps(key);

              return (
                <div key={key} className={`glass-card transition-all ${isEditing ? "border-primary ring-2 ring-primary/20 shadow-glow-primary" : "border-white/5 hover:border-white/20"}`}>
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1 w-full space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">{key}</span>
                          {isEditing && <Badge variant="secondary" className="bg-primary/20 text-primary text-[9px] h-4">עורך כרגע</Badge>}
                        </div>
                        {isEditing ? (
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full mt-1 p-4 rounded-xl border border-white/10 bg-black/40 text-white font-assistant text-base min-h-[100px] focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all duration-150 resize-y outline-none"
                            placeholder="הזן טקסט..."
                          />
                        ) : (
                          <div className="font-assistant text-white/90 text-lg leading-relaxed break-words whitespace-pre-wrap">
                            {content[key] || <span className="text-white/20 italic">(ריק)</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditingKey(null)} disabled={isSaving}>ביטול</Button>
                            <Button size="sm" onClick={() => handleSave(key)} disabled={isSaving}>
                              <Save className="w-3 h-3 ml-1" />
                              {isSaving ? "שומר..." : "שמור"}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEditing(key)}>ערוך טקסט</Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="px-2"
                          onClick={() => setExpandedKey(isExpanded ? null : key)}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Content Styles */}
                    {(isExpanded || isEditing) && (
                      <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
                        {/* Font Size & Alignment */}
                        <div className="space-y-6">
                          <div>
                            <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <Type className="w-4 h-4 text-primary" /> גודל טקסט וסגנון
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {FONT_SIZES.map((fs) => (
                                <button
                                  key={fs.value}
                                  disabled={!isEditing}
                                  onClick={() => setEditProps({ ...editProps, fontSize: fs.value })}
                                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                                    props.fontSize === fs.value 
                                      ? "bg-primary border-primary text-white shadow-glow-primary scale-105" 
                                      : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:border-white/10"
                                  } ${!isEditing && "opacity-40 cursor-default"}`}
                                >
                                  {fs.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <AlignCenter className="w-4 h-4 text-primary" /> יישור טקסט
                            </label>
                            <div className="flex gap-2">
                              {ALIGNMENTS.map((align) => (
                                <button
                                  key={align.value}
                                  disabled={!isEditing}
                                  onClick={() => setEditProps({ ...editProps, alignment: align.value })}
                                  className={`p-3 rounded-xl border transition-all ${
                                    props.alignment === align.value 
                                      ? "bg-primary border-primary text-white shadow-glow-primary scale-105" 
                                      : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:border-white/10"
                                  } ${!isEditing && "opacity-40 cursor-default"}`}
                                  title={align.label}
                                >
                                  <align.icon className="w-5 h-5" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Margins & Icon */}
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ArrowUp className="w-4 h-4 text-primary" /> מרווח עליון
                              </label>
                              <select 
                                disabled={!isEditing}
                                value={props.marginTop || ""}
                                onChange={(e) => setEditProps({ ...editProps, marginTop: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/5 text-white font-assistant text-sm focus:bg-white/10 focus:border-primary/50 transition-all outline-none appearance-none cursor-pointer"
                              >
                                <option value="" className="bg-card">ללא</option>
                                <option value="mt-1" className="bg-card">מינימלי (4px)</option>
                                <option value="mt-2" className="bg-card">קטן (8px)</option>
                                <option value="mt-4" className="bg-card">בינוני (16px)</option>
                                <option value="mt-8" className="bg-card">גדול (32px)</option>
                                <option value="mt-12" className="bg-card">גדול מאוד (48px)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ArrowDown className="w-4 h-4 text-primary" /> מרווח תחתון
                              </label>
                              <select 
                                disabled={!isEditing}
                                value={props.marginBottom || ""}
                                onChange={(e) => setEditProps({ ...editProps, marginBottom: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/5 text-white font-assistant text-sm focus:bg-white/10 focus:border-primary/50 transition-all outline-none appearance-none cursor-pointer"
                              >
                                <option value="" className="bg-card">ללא</option>
                                <option value="mb-1" className="bg-card">מינימלי (4px)</option>
                                <option value="mb-2" className="bg-card">קטן (8px)</option>
                                <option value="mb-4" className="bg-card">בינוני (16px)</option>
                                <option value="mb-8" className="bg-card">גדול (32px)</option>
                                <option value="mb-12" className="bg-card">גדול מאוד (48px)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4 text-primary" /> שם אייקון (Lucide)
                            </label>
                            <input 
                              disabled={!isEditing}
                              type="text"
                              value={props.icon || ""}
                              onChange={(e) => setEditProps({ ...editProps, icon: e.target.value })}
                              placeholder="למשל: Send, User, Settings..."
                              className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/5 text-white font-mono text-sm focus:bg-white/10 focus:border-primary/50 transition-all outline-none"
                            />
                            <p className="text-[10px] text-white/20 mt-2 font-assistant tracking-wide">השתמש בשמות מ-Lucide (למשל CheckCircle, Search)</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
