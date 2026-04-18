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
    { name: "לוח מנהל", keys: ["admin_dashboard_title", "admin_dashboard_search_placeholder", "admin_dashboard_status_all", "admin_dashboard_no_tickets", "label_id", "label_date", "label_description_short", "label_status_change", "label_technician_assign", "label_internal_notes", "label_add_note", "placeholder_internal_note", "msg_new_ticket_toast", "msg_new_ticket_body"] },
    { name: "אחר", keys: ["not_found_title", "not_found_subtitle"] }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-lg shadow border border-border">
        <h2 className="text-xl font-rubik font-bold text-card-foreground">ניהול תוכן ועיצוב (CMS)</h2>
        <p className="text-sm font-assistant text-muted-foreground">עריכת טקסטים, גדלים ומיקומים בכל האתר</p>
      </div>

      {categories.map((cat) => (
        <div key={cat.name} className="space-y-3">
          <h3 className="font-rubik font-semibold text-lg text-primary border-b border-border pb-1">{cat.name}</h3>
          <div className="grid gap-3">
            {cat.keys.map((key) => {
              const isEditing = editingKey === key;
              const isExpanded = expandedKey === key;
              const props = isEditing ? editProps : getContentProps(key);

              return (
                <div key={key} className={`bg-card rounded-lg border transition-all ${isEditing ? "border-primary ring-1 ring-primary/20 shadow-md" : "border-border shadow-sm hover:border-primary/30"}`}>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2 gap-4">
                      <div className="flex-1">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{key}</span>
                        {isEditing ? (
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full mt-1 p-2 rounded border border-border bg-input text-[hsl(222,39%,11%)] font-assistant text-sm min-h-[60px] focus-double-ring transition-all duration-150 resize-y"
                            placeholder="הזן טקסט..."
                          />
                        ) : (
                          <p className="font-assistant text-card-foreground mt-1">{content[key] || <span className="text-muted-foreground italic">(ריק)</span>}</p>
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
                      <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                        {/* Font Size & Alignment */}
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-rubik font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Type className="w-3 h-3" /> גודל טקסט
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {FONT_SIZES.map((fs) => (
                                <button
                                  key={fs.value}
                                  disabled={!isEditing}
                                  onClick={() => setEditProps({ ...editProps, fontSize: fs.value })}
                                  className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                    props.fontSize === fs.value 
                                      ? "bg-primary text-primary-foreground border-primary" 
                                      : "bg-secondary/50 text-muted-foreground border-transparent hover:border-border"
                                  } ${!isEditing && "opacity-60 cursor-default"}`}
                                >
                                  {fs.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-rubik font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <AlignCenter className="w-3 h-3" /> יישור טקסט
                            </label>
                            <div className="flex gap-2">
                              {ALIGNMENTS.map((align) => (
                                <button
                                  key={align.value}
                                  disabled={!isEditing}
                                  onClick={() => setEditProps({ ...editProps, alignment: align.value })}
                                  className={`p-2 rounded border transition-all ${
                                    props.alignment === align.value 
                                      ? "bg-primary text-primary-foreground border-primary" 
                                      : "bg-secondary/50 text-muted-foreground border-transparent hover:border-border"
                                  } ${!isEditing && "opacity-60 cursor-default"}`}
                                  title={align.label}
                                >
                                  <align.icon className="w-4 h-4" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Margins & Icon */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-rubik font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <ArrowUp className="w-3 h-3" /> מרווח עליון (Margin Top)
                              </label>
                              <select 
                                disabled={!isEditing}
                                value={props.marginTop || ""}
                                onChange={(e) => setEditProps({ ...editProps, marginTop: e.target.value })}
                                className="w-full text-[10px] p-1 rounded border border-border bg-input text-[hsl(222,39%,11%)] focus-double-ring"
                              >
                                <option value="">ללא</option>
                                <option value="mt-1">מינימלי (4px)</option>
                                <option value="mt-2">קטן (8px)</option>
                                <option value="mt-4">בינוני (16px)</option>
                                <option value="mt-8">גדול (32px)</option>
                                <option value="mt-12">גדול מאוד (48px)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-rubik font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <ArrowDown className="w-3 h-3" /> מרווח תחתון (Margin Bottom)
                              </label>
                              <select 
                                disabled={!isEditing}
                                value={props.marginBottom || ""}
                                onChange={(e) => setEditProps({ ...editProps, marginBottom: e.target.value })}
                                className="w-full text-[10px] p-1 rounded border border-border bg-input text-[hsl(222,39%,11%)] focus-double-ring"
                              >
                                <option value="">ללא</option>
                                <option value="mb-1">מינימלי (4px)</option>
                                <option value="mb-2">קטן (8px)</option>
                                <option value="mb-4">בינוני (16px)</option>
                                <option value="mb-8">גדול (32px)</option>
                                <option value="mb-12">גדול מאוד (48px)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-rubik font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> אייקון (Lucide Icon Name)
                            </label>
                            <input 
                              disabled={!isEditing}
                              type="text"
                              value={props.icon || ""}
                              onChange={(e) => setEditProps({ ...editProps, icon: e.target.value })}
                              placeholder="למשל: Send, User, Settings..."
                              className="w-full text-xs p-2 rounded border border-border bg-input text-[hsl(222,39%,11%)] font-mono focus-double-ring"
                            />
                            <p className="text-[9px] text-muted-foreground mt-1">השתמש בשמות מ-Lucide (למשל CheckCircle, Search)</p>
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
