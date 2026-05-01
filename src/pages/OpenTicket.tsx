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
      <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4">
        <div className="relative z-10 w-full max-w-md animate-fade-in text-center">
          <div className="bg-card rounded-lg p-8 shadow-lg border border-border">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LucideIcons.Send className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-rubik text-xl font-bold text-card-foreground mb-2">{content["msg_ticket_success_title"]}</h2>
            <p className="text-muted-foreground font-assistant mb-4">{content["msg_ticket_number_label"]}</p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <p className="font-mono-ticket text-2xl font-bold text-primary">{ticketNumber}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => {
                  navigator.clipboard.writeText(ticketNumber);
                  toast({ title: "הועתק", description: "מספר הפנייה הועתק ללוח" });
                }}
                title="העתק מספר פנייה"
              >
                <LucideIcons.Copy className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{content["msg_ticket_success_save_number"]}</p>
          </div>
          <Button asChild variant="ghost" className="mt-6 text-foreground/70 hover:text-foreground">
            <Link to="/">
              <LucideIcons.ArrowRight className="ml-2" />
              חזרה לדף הבית
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-main min-h-screen flex items-center justify-center px-4 py-8">
      <div className="relative z-10 w-full max-w-lg animate-fade-in">
        <h1 className={`font-rubik font-bold text-foreground text-center ${getStyle("open_ticket_title") || "text-3xl mb-4"}`}>
          {content["open_ticket_title"]}
        </h1>
        {content["open_ticket_subtitle"] && (
           <p className={`text-muted-foreground font-assistant text-center mb-8 ${getStyle("open_ticket_subtitle")}`}>
            {content["open_ticket_subtitle"]}
          </p>
        )}

        <form onSubmit={handleSubmit} className="bg-card/70 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-2xl border border-border/50 space-y-5">
          {/* Full Name */}
          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_fullname")}`}>
              {content["label_fullname"]} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                onBlur={() => handleBlur("fullName")}
                className={fieldClass("fullName")}
                placeholder={content["placeholder_fullname"]}
              />
              {isFieldValid("fullName") && <LucideIcons.CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />}
            </div>
            {touched.fullName && errors.fullName && (
              <p className="text-destructive text-sm mt-1 font-assistant flex items-center gap-1">
                <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Department */}
          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5`}>
              מדור *
            </label>
            <div className="relative">
              <select
                value={formData.department}
                onChange={(e) => handleChange("department", e.target.value)}
                onBlur={() => handleBlur("department")}
                className={fieldClass("department")}
              >
                <option value="" disabled>בחר מדור</option>
                {['גיוס','תו״מ','בקרה','ברה״ן','רפואי','פסיכוטכני','פרט','חרדים','קהילה','שלוחת חזון','מל״ג / סמל״ג'].map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {isFieldValid("department") && <LucideIcons.CheckCircle2 className="absolute left-10 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />}
            </div>
            {touched.department && errors.department && (
              <p className="text-destructive text-sm mt-1 font-assistant flex items-center gap-1">
                <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                {errors.department}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_phone")}`}>
              {content["label_phone"]} *
            </label>
            <div className="relative">
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                onBlur={() => handleBlur("phone")}
                className={`${fieldClass("phone")} pl-10`}
                placeholder={content["placeholder_phone"]}
                inputMode="tel"
              />
              {isFieldValid("phone") && <LucideIcons.CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none bg-input" />}
            </div>
            {touched.phone && errors.phone && (
              <p className="text-destructive text-sm mt-1 font-assistant flex items-center gap-1">
                <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                {errors.phone}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_description")}`}>
              {content["label_description"]} *
            </label>
            <div className="relative">
              <textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                onBlur={() => handleBlur("description")}
                className={`w-full min-h-[100px] px-4 py-3 rounded-md border bg-input font-assistant focus-double-ring transition-all duration-150 resize-y ${touched.description && errors.description ? "border-destructive" : isFieldValid("description") ? "border-primary/50" : "border-border"}`}
                placeholder={content["placeholder_description"]}
                maxLength={1000}
              />
            </div>
            {touched.description && errors.description && (
              <p className="text-destructive text-sm mt-1 font-assistant flex items-center gap-1">
                <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                {errors.description}
              </p>
            )}
          </div>



          <p className="text-xs text-muted-foreground font-assistant text-center py-2">
            המידע מוגן ולא יועבר לצד שלישי. משמש אך ורק לצורך טיפול בפנייה.
          </p>

          {globalError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-assistant flex items-start gap-2">
              <LucideIcons.AlertTriangle className="w-5 h-5 shrink-0" />
              <p>{globalError}</p>
            </div>
          )}

          <Button type="submit" size="xl" className={`w-full flex-row-reverse mt-2 bg-teal-500 hover:bg-teal-600 text-white shadow-lg transition-colors border-none ${getStyle("btn_submit_ticket")}`} disabled={submitting}>
            <span className="font-bold text-lg">{submitting ? content["msg_submitting"] : content["btn_submit_ticket"]}</span>
            {renderIcon(getContentProps("btn_submit_ticket").icon, <LucideIcons.Send className="mr-2 w-5 h-5" />)}
          </Button>
        </form>

        <div className="text-center mt-6">
          <Button asChild variant="ghost" className="text-foreground/70 hover:text-foreground">
            <Link to="/">
              <LucideIcons.ArrowRight className="ml-2" />
              {content["btn_back_home"]}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OpenTicket;
