import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useContent } from "@/contexts/ContentContext";

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
    idNumber: "",
    phone: "",
    description: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

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
      case "idNumber":
        if (!value.trim()) return "שדה חובה";
        if (!/^\d{5,9}$/.test(value)) return "תעודת זהות לא תקינה (5-9 ספרות)";
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
      case "file": {
        const f = currentFile ?? null;
        if (f) {
          const validTypes = [
            "image/jpeg", "image/png", "image/gif", "image/webp", 
            "application/pdf", 
            "application/msword", 
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          ];
          if (!validTypes.includes(f.type) && !f.name.endsWith('.doc') && !f.name.endsWith('.docx')) {
             return "סוג קובץ לא נתמך. יש להעלות תמונה, PDF או קובץ Word";
          }
          if (f.size > 10 * 1024 * 1024) return "גודל קובץ מקסימלי: 10MB";
        }
        return "";
      }
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

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setTouched((prev) => ({ ...prev, file: true }));
    setErrors((prev) => ({ ...prev, file: validateField("file", "", f) }));
  };

  const validateAll = () => {
    const fields = ["fullName", "idNumber", "phone", "description"] as const;
    const newErrors: Record<string, string> = {};
    const allTouched: Record<string, boolean> = {};
    fields.forEach((f) => {
      allTouched[f] = true;
      const err = validateField(f, formData[f]);
      if (err) newErrors[f] = err;
    });
    const fileErr = validateField("file", "", file);
    if (fileErr) newErrors.file = fileErr;
    allTouched.file = true;
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
          p_id_number: escapeHtml(formData.idNumber.trim()),
          p_phone: escapeHtml(formData.phone.replace(/-/g, '').trim()),
          p_description: escapeHtml(formData.description.trim())
        });

      if (ticketErr) throw ticketErr;

      // 2. Upload file if present (Now that initial payload is solid)
      if (file && ticketData) {
        const filePath = `${(ticketData as any).id}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("ticket-attachments")
          .upload(filePath, file);

        if (!uploadErr) {
          await supabase.from("ticket_attachments").insert({
            ticket_id: (ticketData as any).id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            content_type: file.type,
          } as any);
        }
      }

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
    } catch (err: any) {
      let desc = "אירעה שגיאה בשליחת הפנייה. נסה שוב.";
      
      const msg = err.message || "";
      if (msg.includes("RATE_LIMIT:DUPLICATE")) {
        desc = "פנייה זו כבר נשלחה למערכת. עקב למניעת כפילויות, אנא המתן.";
      } else if (msg.includes("RATE_LIMIT:IDENTITY")) {
        desc = "פתחת לאחרונה פנייה עבור תעודת זהות או מספר טלפון זה. אנא המתן 5 דקות.";
      } else if (msg.includes("RATE_LIMIT:IP")) {
        desc = "נחסמת זמנית עקב ריבוי פניות. אנא המתן דקה.";
      } else {
        // Forward unexpected/system errors to Telegram
        supabase.functions.invoke("notify-telegram", {
          body: {
            alert_type: "system_error",
            component: "OpenTicket Submission",
            error_message: msg || "Unknown submission error",
          },
        }).catch(console.error);
      }

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
        <h1 className={`font-rubik font-bold text-foreground text-center ${getStyle("open_ticket_title") || "text-2xl mb-8"}`}>
          {content["open_ticket_title"]}
        </h1>
        {content["open_ticket_subtitle"] && (
           <p className={`text-muted-foreground font-assistant text-center mb-6 ${getStyle("open_ticket_subtitle")}`}>
            {content["open_ticket_subtitle"]}
          </p>
        )}

        <form onSubmit={handleSubmit} className="bg-card rounded-lg p-6 sm:p-8 shadow-lg border border-border space-y-5">
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

          {/* ID Number */}
          <div>
            <label className={`block font-assistant font-semibold text-card-foreground text-sm mb-1.5 ${getStyle("label_id_number")}`}>
              {content["label_id_number"]} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => handleChange("idNumber", e.target.value)}
                onBlur={() => handleBlur("idNumber")}
                className={fieldClass("idNumber")}
                placeholder={content["placeholder_id_number"]}
                inputMode="numeric"
              />
              {isFieldValid("idNumber") && <LucideIcons.CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />}
            </div>
            {touched.idNumber && errors.idNumber && (
              <p className="text-destructive text-sm mt-1 font-assistant flex items-center gap-1">
                <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                {errors.idNumber}
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
                className={fieldClass("phone")}
                placeholder={content["placeholder_phone"]}
                inputMode="tel"
              />
              {isFieldValid("phone") && <LucideIcons.CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />}
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

          {/* File */}
          <div>
            <label className="block font-assistant font-semibold text-card-foreground text-sm mb-1.5">צירוף תמונה/קובץ</label>
            <input
              type="file"
              accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="w-full text-sm font-assistant file:ml-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:font-rubik file:font-medium file:cursor-pointer file:transition-all file:duration-150 hover:file:bg-primary-hover"
            />
            {touched.file && errors.file && (
              <p className="text-destructive text-sm mt-1 font-assistant flex items-center gap-1">
                <LucideIcons.AlertCircle className="w-3.5 h-3.5" />
                {errors.file}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground font-assistant text-center py-2">
            המידע מוגן ולא יועבר לצד שלישי. משמש אך ורק לצורך טיפול בפנייה.
          </p>

          <Button type="submit" variant="hero" size="xl" className={`w-full flex-row-reverse mt-2 ${getStyle("btn_submit_ticket")}`} disabled={submitting}>
            <span>{submitting ? content["msg_submitting"] : content["btn_submit_ticket"]}</span>
            {renderIcon(getContentProps("btn_submit_ticket").icon, <LucideIcons.Send className="mr-2" />)}
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
