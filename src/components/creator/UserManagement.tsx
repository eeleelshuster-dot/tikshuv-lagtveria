import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, UserX, Shield, Clock, Check, X, Key, Trash2, AlertTriangle } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import PasswordInput from "@/components/PasswordInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
}

export const UserManagement = ({ session }: { session: Session | null }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("admin");

  // Reset Password State
  const [resetUser, setResetUser] = useState<Profile | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Delete User State
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "שגיאה בטעינת משתמשים", description: error.message, variant: "destructive" });
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUsername.trim()) {
      toast({ title: "שגיאה", description: "שם מלא ושם משתמש הם שדות חובה", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "שגיאה", description: "הסיסמה חייבת להכיל לפחות 6 תווים", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { username: newUsername, password: newPassword, full_name: newFullName, role: newRole }
      });

      if (error) {
        let errorMsg = "שגיאה לא צפויה";
        if (error instanceof Error) {
          try {
            // Try to extract error message from response if it's a FunctionsHttpError
            const body = await (error as any).response?.json();
            errorMsg = body?.error || error.message;
          } catch {
            errorMsg = error.message;
          }
        }
        throw new Error(errorMsg);
      }

      toast({ title: "משתמש נוצר בהצלחה" });
      setShowCreate(false);
      setNewUsername("");
      setNewPassword("");
      setNewFullName("");
      fetchProfiles();
    } catch (err: any) {
      console.error("Create user error:", err);
      toast({
        title: "שגיאה ביצירת משתמש",
        description: err.message || "שגיאה לא צפויה",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("profiles").update({ active: !currentActive }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } else {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, active: !currentActive } : p));
      toast({ title: currentActive ? "משתמש הושבת" : "משתמש הופעל" });
    }
  };

  const changeRole = async (id: string, newRowRole: string) => {
    const roleToSave = newRowRole as any;
    const { error } = await supabase.from("profiles").update({ role: roleToSave }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } else {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, role: newRowRole } : p));
      toast({ title: "תפקיד שונה בהצלחה" });
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser || !resetPasswordValue) return;
    setIsResetting(true);
    try {
      const { error } = await supabase.functions.invoke("reset-password", {
        body: { userId: resetUser.id, newPassword: resetPasswordValue }
      });
      if (error) throw error;
      toast({ title: "סיסמה שונתה בהצלחה", description: "המשתמש יתבקש להחליף סיסמה בכניסה הבאה" });
      setResetUser(null);
      setResetPasswordValue("");
    } catch (err: any) {
      toast({ title: "שגיאה בשינוי סיסמה", description: err.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    if (session?.user?.id === deleteUser.id) {
      toast({ title: "שגיאה", description: "לא ניתן למחוק את החשבון המחובר", variant: "destructive" });
      setDeleteUser(null);
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId: deleteUser.id }
      });
      if (error) throw error;
      toast({ title: "משתמש נמחק בהצלחה" });
      setProfiles(prev => prev.filter(p => p.id !== deleteUser.id));
      setDeleteUser(null);
    } catch (err: any) {
      toast({ title: "שגיאה במחיקת משתמש", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg shadow border border-border">
        <div>
          <h2 className="text-xl font-rubik font-bold text-card-foreground">משתמשי מערכת</h2>
          <p className="text-sm font-assistant text-muted-foreground">ניהול הרשאות וגישה למערכת</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} variant={showCreate ? "secondary" : "default"} className="flex-row-reverse">
          <span>{showCreate ? "ביטול" : "משתמש חדש"}</span>
          {showCreate ? <X className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateUser} className="bg-card p-6 rounded-lg shadow-lg border border-border space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-rubik font-semibold text-lg border-b border-border pb-2 mb-4">יצירת משתמש חדש</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-assistant font-medium mb-1">שם מלא</label>
              <input type="text" value={newFullName} onChange={e => setNewFullName(e.target.value)} className="w-full h-10 px-3 rounded border border-border bg-input font-assistant text-sm" placeholder="שם מלא" />
            </div>
            <div>
              <label className="block text-sm font-assistant font-medium mb-1">שם משתמש</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full h-10 px-3 rounded border border-border bg-input font-assistant text-sm" placeholder="שם משתמש (ללא רווחים)" />
            </div>
            <div>
              <label className="block text-sm font-assistant font-medium mb-1">סיסמה זמנית</label>
              <PasswordInput value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="סיסמה (לפחות 6 תווים)" />
            </div>
            <div>
              <label className="block text-sm font-assistant font-medium mb-1">תפקיד</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full h-10 px-3 rounded border border-border bg-input font-assistant text-sm">
                <option value="admin">מנהל</option>
                <option value="creator">יוצר (Creator)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit">יצירת משתמש מורשה</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center p-8 text-muted-foreground animate-pulse">טוען נתונים...</div>
      ) : (
        <div className="bg-card rounded-lg shadow overflow-x-auto border border-border">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-secondary/50 border-b border-border text-sm font-rubik text-muted-foreground">
                <th className="p-3">שם מלא</th>
                <th className="p-3">שם משתמש</th>
                <th className="p-3">אימייל פנימי</th>
                <th className="p-3">תפקיד</th>
                <th className="p-3">סטטוס פעילות</th>
                <th className="p-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-3 font-assistant text-sm">{p.full_name}</td>
                  <td className="p-3 font-assistant text-sm text-primary">{p.username}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{p.email}</td>
                  <td className="p-3">
                    <select value={p.role} onChange={(e) => changeRole(p.id, e.target.value)} className="h-8 px-2 rounded border border-border bg-input font-assistant text-xs">
                      <option value="admin">מנהל</option>
                      <option value="creator">יוצר</option>
                    </select>
                  </td>
                  <td className="p-3">
                    {p.active ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-500/10 text-green-600 rounded-full font-medium">
                        <Check className="w-3 h-3" /> פעיל
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-full font-medium">
                        <UserX className="w-3 h-3" /> מושבת
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setResetUser(p)} title="שינוי סיסמה" className="h-8 w-8 p-0">
                        <Key className="w-3 h-3 text-muted-foreground" />
                      </Button>
                      <Button variant={p.active ? "secondary" : "default"} size="sm" onClick={() => toggleActive(p.id, p.active)} className="h-8 text-xs">
                        {p.active ? "השבת" : "הפעל"}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setDeleteUser(p)} 
                        title="מחיקת משתמש" 
                        className="h-8 w-8 p-0 hover:text-destructive hover:bg-destructive/10"
                        disabled={session?.user?.id === p.id}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-rubik">שינוי סיסמה עבור {resetUser?.full_name}</DialogTitle>
            <DialogDescription className="font-assistant">הזן סיסמה חדשה למשתמש זה. המשתמש יידרש להחליף אותה בכניסה הבאה.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-assistant font-medium mb-1">סיסמה חדשה</label>
            <PasswordInput
              value={resetPasswordValue}
              onChange={e => setResetPasswordValue(e.target.value)}
              placeholder="מינימום 8 תווים"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>ביטול</Button>
            <Button onClick={handleResetPassword} disabled={isResetting || !resetPasswordValue}>
              {isResetting ? "מעדכן..." : "שנה סיסמה עכשיו"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <Dialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent className="sm:max-w-md border-destructive/20">
          <DialogHeader>
            <DialogTitle className="font-rubik flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> מחיקת משתמש לצמיתות
            </DialogTitle>
            <DialogDescription className="font-assistant">
              האם אתה בטוח שברצונך למחוק את <strong>{deleteUser?.full_name}</strong>? פעולה זו אינה ניתנת לביטול ותמחק את כל נתוני המשתמש מהמערכת.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>ביטול</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting ? "מוחק..." : "כן, מחק משתמש"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
