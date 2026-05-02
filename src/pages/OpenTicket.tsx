import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useContent } from "@/contexts/ContentContext";
import { formatError } from "@/utils/errorHandler";

const generateTicketNumber = () => {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return `TK-${(array[0] % 900000) + 100000}`;
};

const OpenTicket = () => {
  const { toast } = useToast();
  const { content, getContentProps } = useContent();
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    department: "",
    phone: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const renderIcon = (iconName: string | undefined, fallback: any) => {
    if (!iconName) return fallback;
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent ? <IconComponent className="mr-2" /> : fallback;
  };

  const getStyle = (key: string) => {
    const props = getContentProps(key);
    return `${props.fontSize || ""} ${props.alignment || ""} ${props.marginTop || ""} ${props.marginBottom || ""}`.trim();
  };

  const validateField = useCallback((field: string, value: string, currentFile?: File | null) => {
    switch (field) {
      case "fullName":
        if (!value.trim()) return "שדה חובה";
        if (value.trim().length < 2) return "שם קצר מדי";
        return "";
      case "department":
        if (!value) return "שדה חובה";
        return "";
      case "phone": {
        if (!value.trim()) return "שדה חובה";
        const cleanPhone = value.replace(/-/g, '');
        if (!/^0\d{8,9}$/.test(cleanPhone)) return "מספר טלפון לא תקין";
        return "";
      }
      case "description":
        if (!value.trim()) return "שדה חובה";
        if (value.trim().length < 5) return "תיאור קצר מדי (לפחות 5 תווים)";
        return "";
      default:
        return "";
    }
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({
      ...prev,
      [field]: validateField(field, formData[field as keyof typeof formData]),
    }));
  };

  const validateAll = () => {
    const fields = ["fullName", "department", "phone", "description"] as const;
    const newErrors: Record<string, string> = {};
    const allTouched: Record<string, boolean> = {};
    fields.forEach((f) => {
      allTouched[f] = true;
      const err = validateField(f, formData[f]);
      if (err) newErrors[f] = err;
    });
    setTouched(allTouched);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // Absolute immediate bailout stopping double clicks
    if (!validateAll()) return;

    setSubmitting(true);
    const ticket = generateTicketNumber();

    const escapeHtml = (unsafe: string) => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    try {
      // 1. Atomic insertion of ticket and history
      const { data: ticketData, error: ticketErr } = await supabase
        .rpc("submit_ticket_atomic", {
          p_ticket_number: ticket,
          p_full_name: escapeHtml(formData.fullName.trim()),
          p_department: escapeHtml(formData.department.trim()),
          p_phone: escapeHtml(formData.phone.replace(/-/g, '').trim()),
          p_description: escapeHtml(formData.description.trim())
        });

      if (ticketErr) throw ticketErr;

      // Send Telegram notification (fire-and-forget)
      supabase.functions.invoke("notify-telegram", {
        body: {
          ticket_number: ticket,
          full_name: formData.fullName.trim(),
          description: formData.description.trim(),
        },
      }).catch((err) => console.error("Telegram notification failed:", err));

      setTicketNumber(ticket);
      setSubmitted(true);
      setGlobalError("");
    } catch (err: any) {
      let desc = "אירעה שגיאה בשליחת הפנייה. נסה שוב.";
      
      const msg = err.message || "";
      if (msg.includes("RATE_LIMIT:DUPLICATE")) {
        desc = "פנייה זו כבר נשלחה למערכת. עקב למניעת כפילויות, אנא המתן.";
      } else if (msg.includes("RATE_LIMIT:IDENTITY")) {
        desc = "פתחת לאחרונה פנייה עבור מספר טלפון זה. אנא המתן 5 דקות.";
      } else if (msg.includes("RATE_LIMIT:IP")) {
        desc = "נחסמת זמנית עקב ריבוי פניות. אנא המתן דקה.";
      } else {
        desc = formatError(msg);
        // Forward unexpected/system errors to Telegram
        supabase.functions.invoke("notify-telegram", {
          body: {
            alert_type: "system_error",
            component: "OpenTicket Submission",
            error_message: msg || "Unknown submission error",
          },
        }).catch(console.error);
      }

      setGlobalError(desc);
      toast({
        title: "שגיאה",
        description: desc,
        variant: "destructive",
      });
      // Basic rate limit fallback on error allowing form reactivation 
      setTimeout(() => setSubmitting(false), 5000);
    } finally {
      if (!submitted) {
          // If successful, it stays submitting/submitted. If errored, timeout opens it up.
          // But finally block triggers immediately, so we shouldn't immediately set false if we want a throttle.
          // Let's rely on the error catch logic for throttling!
      }
    }
  };

  const isFieldValid = (field: string) => touched[field] && !errors[field] && formData[field as keyof typeof formData]?.trim();

  const fieldClass = (field: string) => {
    const base = "w-full h-11 px-4 rounded-md border bg-input font-assistant focus-double-ring transition-all duration-150 text-[hsl(var(--input-text))]";
    if (touched[field] && errors[field]) return `${base} border-destructive`;
    if (isFieldValid(field)) return `${base} border-primary/50`;
    return `${base} border-border`;
  };

  if (submitted) {
    return (
      <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4 py-12">
        <div className="relative z-10 w-full max-w-md animate-fade-in text-center space-y-8">
          <div className="glass-card p-10 border-white/10 shadow-2xl space-y-6">
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto text-primary shadow-glow-primary animate-pulse">
              <LucideIcons.Send className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="font-rubik text-3xl font-bold text-white leading-tight">
                {content["msg_ticket_success_title"]}
              </h2>
              <p className="text-white/40 font-assistant text-lg">
                {content["msg_ticket_number_label"]}
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-center gap-4">
                <p className="font-mono text-4xl font-bold text-primary tracking-tighter">{ticketNumber}</p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all" 
                  onClick={() => {
                    navigator.clipboard.writeText(ticketNumber);
                    toast({ title: "הועתק", description: "מספר הפנייה הועתק ללוח" });
                  }}
                  title="העתק מספר פנייה"
                >
                  <LucideIcons.Copy className="w-6 h-6" />
                </Button>
              </div>
              <p className="text-xs text-white/30 font-assistant leading-relaxed">
                {content["msg_ticket_success_save_number"]}
              </p>
            </div>
          </div>

          <Button asChild variant="ghost" className="text-white/30 hover:text-white rounded-xl h-12 px-8">
            <Link to="/" className="flex items-center gap-2">
              <LucideIcons.ArrowRight className="w-4 h-4" />
              <span>חזרה לדף הבית</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-main min-h-screen px-4 py-12 flex items-center justify-center">
      <div className="relative z-10 w-full max-w-xl animate-fade-in space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-rubik font-bold text-white tracking-tight">
            {content["open_ticket_title"]}
          </h1>
          {content["open_ticket_subtitle"] && (
             <p className="text-white/40 font-assistant text-lg sm:text-xl">
              {content["open_ticket_subtitle"]}
            </p>
          )}
        </div>

        <div className="glass-card p-8 sm:p-12 space-y-8 border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block px-1">
                {content["label_fullname"]} *
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  onBlur={() => handleBlur("fullName")}
                  className={`glass-input h-14 w-full pr-12 rounded-xl transition-all ${touched.fullName && errors.fullName ? 'border-destructive/50' : ''}`}
                  placeholder={content["placeholder_fullname"]}
                />
                <LucideIcons.User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                {isFieldValid("fullName") && <LucideIcons.CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />}
              </div>
              {touched.fullName && errors.fullName && (
                <p className="text-destructive text-xs font-bold flex items-center gap-1.5 px-1">
                  <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block px-1">
                מדור רלוונטי *
              </label>
              <div className="relative group">
                <select
                  value={formData.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  onBlur={() => handleBlur("department")}
                  className={`glass-input h-14 w-full pr-12 rounded-xl appearance-none transition-all ${touched.department && errors.department ? 'border-destructive/50' : ''}`}
                >
                  <option value="" disabled className="bg-card">בחר מדור מהרשימה</option>
                  {['גיוס','תו״מ','בקרה','ברה״ן','רפואי','פסיכוטכני','פרט','חרדים','קהילה','שלוחת חזון','מל״ג / סמל״ג'].map((dept) => (
                    <option key={dept} value={dept} className="bg-card">{dept}</option>
                  ))}
                </select>
                <LucideIcons.Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors pointer-events-none" />
                <LucideIcons.ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
              </div>
              {touched.department && errors.department && (
                <p className="text-destructive text-xs font-bold flex items-center gap-1.5 px-1">
                  <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                  {errors.department}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block px-1">
                {content["label_phone"]} *
              </label>
              <div className="relative group">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  onBlur={() => handleBlur("phone")}
                  className={`glass-input h-14 w-full pr-12 rounded-xl transition-all ${touched.phone && errors.phone ? 'border-destructive/50' : ''}`}
                  placeholder={content["placeholder_phone"]}
                  inputMode="tel"
                />
                <LucideIcons.Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                {isFieldValid("phone") && <LucideIcons.CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />}
              </div>
              {touched.phone && errors.phone && (
                <p className="text-destructive text-xs font-bold flex items-center gap-1.5 px-1">
                  <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block px-1">
                {content["label_description"]} *
              </label>
              <div className="relative group">
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  onBlur={() => handleBlur("description")}
                  className={`glass-input min-h-[140px] w-full pr-12 py-4 rounded-xl transition-all resize-none ${touched.description && errors.description ? 'border-destructive/50' : ''}`}
                  placeholder={content["placeholder_description"]}
                  maxLength={1000}
                />
                <LucideIcons.MessageSquare className="absolute right-4 top-4 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
              </div>
              {touched.description && errors.description && (
                <p className="text-destructive text-xs font-bold flex items-center gap-1.5 px-1">
                  <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                  {errors.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
              <LucideIcons.ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <p className="text-[10px] text-white/30 font-assistant leading-relaxed uppercase tracking-wider">
                המידע מוגן ומאובטח ברמת הצפנה ממשלתית. משמש לטיפול בפנייה בלבד.
              </p>
            </div>

            {globalError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-sm font-bold flex items-start gap-3 animate-pulse">
                <LucideIcons.AlertTriangle className="w-5 h-5 shrink-0" />
                <p>{globalError}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full btn-primary h-16 rounded-2xl text-xl shadow-glow-primary group"
              disabled={submitting}
            >
              <span className="font-bold">{submitting ? content["msg_submitting"] : content["btn_submit_ticket"]}</span>
              {!submitting && <LucideIcons.Send className="mr-3 w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
            </Button>
          </form>
        </div>

        <div className="text-center pt-4">
          <Button asChild variant="ghost" className="text-white/30 hover:text-white rounded-xl">
            <Link to="/" className="flex items-center gap-2">
              <LucideIcons.ArrowRight className="w-4 h-4" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OpenTicket;
