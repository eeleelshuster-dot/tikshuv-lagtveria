import { useState, useEffect } from "react";
import { Search, Calendar as CalendarIcon, Filter, X } from "lucide-react";
import { format, isFuture, isFriday, isSaturday } from "date-fns";
import { he } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

interface FilterPanelProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (val: string) => void;
  dateFilter: Date | undefined;
  setDateFilter: (val: Date | undefined) => void;
  showArchived?: boolean;
  setShowArchived?: (val: boolean) => void;
  onClearFilters?: () => void;
}

export const FilterPanel = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  departmentFilter,
  setDepartmentFilter,
  dateFilter,
  setDateFilter,
  showArchived = false,
  setShowArchived,
}: FilterPanelProps) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const activeFiltersCount = [
    statusFilter !== 'all',
    departmentFilter !== 'all',
    !!dateFilter
  ].filter(Boolean).length;

  const StatusChips = () => (
    <div className="flex flex-wrap gap-2">
      {[
        { id: 'all', label: 'הכל' },
        { id: 'sent', label: 'נשלח' },
        { id: 'in_progress', label: 'בטיפול' },
        { id: 'forwarded', label: 'הועבר' },
        { id: 'resolved', label: 'טופל' },
        { id: 'closed', label: 'סגור' }
      ].map((s) => (
        <button
          key={s.id}
          onClick={() => setStatusFilter(s.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-assistant border transition-all ${
            statusFilter === s.id 
              ? 'bg-primary border-primary text-white shadow-md' 
              : 'bg-secondary/40 border-border text-muted-foreground hover:bg-secondary/60'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  const DeptChips = () => (
    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
      {['all', 'גיוס','תו״מ','בקרה','ברה״ן','רפואי','פסיכוטכני','פרט','חרדים','קהילה','שלוחת חזון','מל״ג / סמל״ג'].map((dept) => (
        <button
          key={dept}
          onClick={() => setDepartmentFilter(dept)}
          className={`px-3 py-1.5 rounded-full text-xs font-assistant border transition-all ${
            departmentFilter === dept 
              ? 'bg-accent border-accent text-white shadow-md' 
              : 'bg-secondary/40 border-border text-muted-foreground hover:bg-secondary/60'
          }`}
        >
          {dept === 'all' ? 'כל המדורים' : dept}
        </button>
      ))}
    </div>
  );

  // Sync with URL Query Params could be managed in the parent, or done here if we prefer hook-based sync.
  // The requirements say: "Support query params: status, department, q, date"
  // It's usually better to manage URL state in the parent or custom hook to keep this component pure,
  // but we can ensure the props represent the state.
  
  return (
    <>
      {/* Desktop Filter Panel */}
      <div className="hidden lg:block glass-card p-6 mb-6 animate-in fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="w-5 h-5" />
            <span className="font-rubik font-bold text-base">מרכז סינון וחיפוש</span>
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs text-muted-foreground hover:text-foreground">
              נקה {activeFiltersCount} מסננים
            </Button>
          )}
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pr-10 pl-4 rounded-xl border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
                placeholder="חיפוש לפי שם או מספר פנייה..."
              />
            </div>

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={`h-11 justify-start text-right font-assistant rounded-xl ${!dateFilter && "text-muted-foreground"}`}>
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {dateFilter ? format(dateFilter, "PPP", { locale: he }) : <span>סינון לפי תאריך</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={(date) => { setDateFilter(date); setIsCalendarOpen(false); }}
                  locale={he}
                  disabled={(date) => isFuture(date) || isFriday(date) || isSaturday(date)}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground px-1">סטטוס פנייה</label>
              <StatusChips />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground px-1">מדור רלוונטי</label>
              <DeptChips />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Button */}
      <div className="lg:hidden flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pr-10 pl-4 rounded-xl border border-border bg-input font-assistant text-sm"
            placeholder="חיפוש מהיר..."
          />
        </div>
        <Button 
          variant="outline" 
          className="h-11 rounded-xl px-4 relative"
          onClick={() => setIsMobileFilterOpen(true)}
        >
          <Filter className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <Badge className="absolute -top-2 -left-2 bg-primary text-white w-5 h-5 flex items-center justify-center p-0 rounded-full text-[10px]">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Mobile Filter Modal */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden animate-in fade-in">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileFilterOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="font-rubik font-bold text-lg">סינון מתקדם</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsMobileFilterOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-8 overflow-y-auto pb-32">
              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground">סטטוס פנייה</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: 'הכל' },
                    { id: 'sent', label: 'נשלח' },
                    { id: 'in_progress', label: 'בטיפול' },
                    { id: 'forwarded', label: 'הועבר' },
                    { id: 'resolved', label: 'טופל' },
                    { id: 'closed', label: 'סגור' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStatusFilter(s.id)}
                      className={`h-10 rounded-lg text-sm font-assistant border transition-all ${
                        statusFilter === s.id 
                          ? 'bg-primary border-primary text-white shadow-md' 
                          : 'bg-secondary/40 border-border text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground">מדור רלוונטי</label>
                <div className="grid grid-cols-2 gap-2">
                  {['all', 'גיוס','תו״מ','בקרה','ברה״ן','רפואי','פסיכוטכני','פרט','חרדים','קהילה'].map((dept) => (
                    <button
                      key={dept}
                      onClick={() => setDepartmentFilter(dept)}
                      className={`h-10 rounded-lg text-xs font-assistant border transition-all ${
                        departmentFilter === dept 
                          ? 'bg-accent border-accent text-white shadow-md' 
                          : 'bg-secondary/40 border-border text-muted-foreground'
                      }`}
                    >
                      {dept === 'all' ? 'כל המדורים' : dept}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground">תאריך פתיחה</label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full h-11 justify-between font-assistant rounded-lg ${!dateFilter && "text-muted-foreground"}`}>
                      <span>{dateFilter ? format(dateFilter, "PPP", { locale: he }) : "בחר תאריך"}</span>
                      <CalendarIcon className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={dateFilter}
                      onSelect={(date) => { setDateFilter(date); setIsCalendarOpen(false); }}
                      locale={he}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-card/90 backdrop-blur-md sticky bottom-0 flex gap-3 z-10">
              <Button 
                variant="ghost" 
                className="flex-1 font-assistant h-12" 
                onClick={() => { onClearFilters?.(); setIsMobileFilterOpen(false); }}
              >
                נקה הכל
              </Button>
              <Button 
                className="flex-1 font-assistant font-bold h-12 bg-primary shadow-lg" 
                onClick={() => setIsMobileFilterOpen(false)}
              >
                החל סינון
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
