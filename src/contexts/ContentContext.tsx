import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContentProperties {
  fontSize?: string;
  alignment?: string;
  marginTop?: string;
  marginBottom?: string;
  icon?: string;
}

// Core default translations representing existing hardcoded Israeli texts in the app.
const defaultContent: Record<string, string> = {
  // Index
  "home_hero_title": "מערכת ניהול פניות מתקדמת",
  "home_hero_subtitle": "שירות מהיר, יעיל ומקצועי לכל פנייה",
  "home_btn_open": "פתיחת פנייה חדשה",
  "home_btn_track": "מעקב אחר פנייה",
  "home_link_admin": "כניסת מנהל",
  "home_footer_credit": "נבנה עבור שירות מקצועי ומתקדם",

  // OpenTicket
  "open_ticket_title": "פתיחת פנייה חדשה",
  "open_ticket_subtitle": "אנא מלא את פרטי הפנייה ויחזרו אליך בהקדם",
  "label_fullname": "שם מלא",
  "label_id_number": "תעודת זהות",
  "label_phone": "מספר טלפון",
  "label_description": "תיאור הפנייה",
  "placeholder_fullname": "הזן שם מלא",
  "placeholder_id_number": "הזן תעודת זהות",
  "placeholder_phone": "050-0000000",
  "placeholder_description": "תאר את התקלה...",
  "btn_submit_ticket": "שליחת פנייה",
  "btn_back_home": "חזרה לדף הבית",
  "msg_submitting": "שולח...",

  // TrackTicket
  "track_ticket_title": "מעקב אחר פנייה",
  "track_ticket_subtitle": "הזן את מספר הפנייה שקיבלת כדי למצוא את הסטטוס שלה",
  "label_ticket_number": "מספר פנייה",
  "placeholder_ticket_number": "הזן מספר פנייה",
  "btn_search_ticket": "חיפוש פנייה",

  // AdminLogin
  "admin_login_title": "כניסת מנהל",
  "label_username": "שם משתמש",
  "label_password": "סיסמה",
  "placeholder_username": "שם משתמש",
  "placeholder_password": "סיסמה",
  "checkbox_remember": "זכור אותי",
  "btn_login": "כניסה",
  "msg_logging_in": "מתחבר...",

  // Admin Dashboard
  "admin_dashboard_title": "לוח בקרה - מנהל",
  "admin_dashboard_search_placeholder": "חיפוש לפי מספר פנייה, שם או ת.ז.",
  "admin_dashboard_status_all": "כל הסטטוסים",
  "admin_dashboard_no_tickets": "לא נמצאו פניות",
  "msg_ticket_success_title": "הפנייה נשלחה בהצלחה",
  "msg_ticket_number_label": "מספר פנייה:",
  "msg_ticket_success_save_number": "שמור את מספר פנייה למעקב",
  "label_ticket_status": "סטטוס פנייה",
  "label_ref_name": "שם הפונה",
  "label_ref_description": "תיאור הפנייה",
  "label_recent_updates": "עדכונים אחרונים",
  "msg_no_updates": "אין עדכונים זמינים כרגע",
  "label_id": "תעודת זהות",
  "label_date": "תאריך",
  "label_description_short": "תיאור",
  "label_status_change": "שינוי סטטוס",
  "label_technician_assign": "שיוך טכנאי",
  "label_internal_notes": "הערות פנימיות",
  "label_add_note": "הוסף הערה",
  "placeholder_internal_note": "הוסף הערה פנימית...",
  "msg_new_ticket_toast": "פנייה חדשה!",
  "msg_new_ticket_body": "פנייה {number} נפתחה על ידי {name}",

  // ChangePassword
  "change_password_title": "שינוי סיסמה",
  "change_password_subtitle": "נא לבחור סיסמה חדשה בהתחברות הראשונה",
  "label_new_password": "סיסמה חדשה",
  "label_confirm_password": "אימות סיסמה",
  "placeholder_new_password": "לפחות 8 תווים",
  "placeholder_confirm_password": "הזן שוב את הסיסמה",
  "msg_passwords_match": "הסיסמאות תואמות",
  "btn_save_password": "שמור סיסמה",
  "msg_password_min_length": "סיסמה חייבת להכיל לפחות 8 תווים",
  "msg_passwords_dont_match": "הסיסמאות אינן תואמות",
  "msg_saving": "שומר...",

  // NotFound
  "not_found_title": "404 - הדף לא נמצא",
  "not_found_subtitle": "מצטערים, הדף שחיפשת אינו קיים",
};

const defaultProps: Record<string, ContentProperties> = {};

interface ContentContextType {
  content: Record<string, string>;
  getContentProps: (key: string) => ContentProperties;
  loading: boolean;
  refreshContent: () => Promise<void>;
  updateContent: (key: string, value: string, props?: ContentProperties) => Promise<void>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export const useContent = () => {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContent must be used within ContentProvider");
  return ctx;
};

export const ContentProvider = ({ children }: { children: ReactNode }) => {
  const [content, setContent] = useState<Record<string, string>>(defaultContent);
  const [contentProps, setContentProps] = useState<Record<string, ContentProperties>>(defaultProps);
  const [loading, setLoading] = useState(true);

  const refreshContent = async () => {
    try {
      const { data, error } = await (supabase.from("app_content" as any) as any).select("key, value_published, placement_rules");
      if (error) {
        console.warn("Could not load dynamic content. Falling back to defaults.", error);
      } else if (data) {
        const remoteContent = { ...defaultContent };
        const remoteProps = { ...defaultProps };
        (data as any[]).forEach(item => {
          remoteContent[item.key] = item.value_published;
          if (item.placement_rules) {
            remoteProps[item.key] = item.placement_rules as ContentProperties;
          }
        });
        setContent(remoteContent);
        setContentProps(remoteProps);
      }
    } catch (err) {
      console.warn("Failed to catch content:", err);
    } finally {
      setLoading(false);
    }
  };

  const getContentProps = (key: string): ContentProperties => {
    return contentProps[key] || {};
  };

  const updateContent = async (key: string, value: string, props?: ContentProperties) => {
    const previousValue = content[key];
    const { data: { user } } = await supabase.auth.getUser();

    // Optimistic update
    setContent(prev => ({ ...prev, [key]: value }));
    if (props) {
      setContentProps(prev => ({ ...prev, [key]: props }));
    }
    
    try {
      await (supabase.from("app_content" as any) as any).upsert({ 
        key, 
        value_published: value, 
        value_draft: value,
        placement_rules: props || getContentProps(key)
      });

      // Audit log
      await (supabase.from("content_audit_log" as any) as any).insert({
        key,
        previous_value: previousValue,
        new_value: value,
        changed_by: user?.id,
        status: "published"
      });

    } catch (e) {
      console.error(e);
      // rollback if needed
    }
  };

  useEffect(() => {
    refreshContent();
  }, []);

  return (
    <ContentContext.Provider value={{ content, getContentProps, loading, refreshContent, updateContent }}>
      {children}
    </ContentContext.Provider>
  );
};
