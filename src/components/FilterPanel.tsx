import { useState } from "react";
import { Search, Calendar as CalendarIcon, Filter, X, RotateCcw, Check } from "lucide-react";
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

const STATUS_OPTIONS = [
  { id: 'all', label: 'הכל' },
  { id: 'sent', label: 'נשלח' },
  { id: 'in_progress', label: 'בטיפול' },
  { id: 'forwarded', label: 'הועבר' },
  { id: 'resolved', label: 'טופל' },
  { id: 'closed', label: 'סגור' }
];

const DEPT_OPTIONS = ['all', 'גיוס','תו״מ','בקרה','ברה״ן','רפואי','פסיכוטכני','פרט','חרדים','קהילה'];

export const FilterPanel = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  departmentFilter,
  setDepartmentFilter,
  dateFilter,
  setDateFilter,
  onClearFilters,
}: FilterPanelProps) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const activeFiltersCount = [
    statusFilter !== 'all',
    departmentFilter !== 'all',
    !!dateFilter
  ].filter(Boolean).length;

  return (
    <>
      {/* Desktop Filter Panel */}
      <div className="hidden lg:block glass-card p-6 mb-8 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Filter className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold font-rubik mb-0">מרכז סינון מתקדם</h2>
          </div>
          {activeFiltersCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters} 
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-2 hover:bg-destructive/5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              נקה {activeFiltersCount} מסננים
            </Button>
          )}
        </div>
        
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-white/10 bg-white/5 font-assistant text-sm focus:bg-white/10 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                placeholder="חפש לפי שם פונה או מספר פנייה..."
              />
            </div>

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={`h-12 justify-start text-right font-assistant rounded-xl border-white/10 bg-white/5 hover:bg-white/10 transition-all ${!dateFilter && "text-muted-foreground"}`}>
                  <CalendarIcon className="ml-3 h-4 w-4 text-primary" />
                  {dateFilter ? format(dateFilter, "PPP", { locale: he }) : <span>סינון לפי תאריך</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border-white/10 shadow-2xl" align="end">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider px-1">סטטוס פנייה</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStatusFilter(s.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold font-assistant border transition-all duration-200 ${
                      statusFilter === s.id 
                        ? 'bg-primary border-primary text-white shadow-glow-primary scale-105' 
                        : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wider px-1">מדור רלוונטי</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                {DEPT_OPTIONS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-4 py-2 rounded-full text-xs font-bold font-assistant border transition-all duration-200 ${
                      departmentFilter === dept 
                        ? 'bg-accent border-accent text-white shadow-lg scale-105' 
                        : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    {dept === 'all' ? 'כל המדורים' : dept}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar & Filter Toggle */}
      <div className="lg:hidden flex gap-3 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pr-12 pl-4 rounded-xl border border-white/10 bg-white/5 font-assistant text-sm text-white focus:bg-white/10 outline-none transition-all"
            placeholder="חיפוש מהיר..."
          />
        </div>
        <Button 
          variant="outline" 
          className={`h-12 w-12 rounded-xl p-0 relative border-white/10 transition-all ${activeFiltersCount > 0 ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5'}`}
          onClick={() => setIsMobileFilterOpen(true)}
        >
          <Filter className="w-5 h-5" />
          {activeFiltersCount > 0 && (
            <Badge className="absolute -top-2 -left-2 bg-primary text-white w-6 h-6 flex items-center justify-center p-0 rounded-full text-[11px] font-bold shadow-lg animate-pulse-soft">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Mobile Filter Modal */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsMobileFilterOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-white/10 rounded-t-[2.5rem] max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-500 ease-out">
            <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Filter className="w-5 h-5" />
                </div>
                <h3 className="font-rubik font-bold text-xl">סינון פניות</h3>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full w-10 h-10 p-0 hover:bg-white/10" onClick={() => setIsMobileFilterOpen(false)}>
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="p-6 space-y-10 overflow-y-auto pb-32">
              {/* Status Section */}
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">סטטוס פנייה</label>
                <div className="grid grid-cols-2 gap-3">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStatusFilter(s.id)}
                      className={`h-12 rounded-xl text-sm font-bold font-assistant border flex items-center justify-center gap-2 transition-all ${
                        statusFilter === s.id 
                          ? 'bg-primary border-primary text-white shadow-glow-primary' 
                          : 'bg-white/5 border-white/5 text-white/60 active:bg-white/10'
                      }`}
                    >
                      {statusFilter === s.id && <Check className="w-4 h-4" />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department Section */}
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">מדור רלוונטי</label>
                <div className="grid grid-cols-2 gap-3">
                  {DEPT_OPTIONS.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => setDepartmentFilter(dept)}
                      className={`h-12 rounded-xl text-xs font-bold font-assistant border flex items-center justify-center gap-2 transition-all ${
                        departmentFilter === dept 
                          ? 'bg-accent border-accent text-white shadow-lg' 
                          : 'bg-white/5 border-white/5 text-white/60 active:bg-white/10'
                      }`}
                    >
                      {departmentFilter === dept && <Check className="w-3.5 h-3.5" />}
                      {dept === 'all' ? 'כל המדורים' : dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Section */}
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">תאריך פתיחה</label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full h-14 justify-between font-bold font-assistant rounded-xl border-white/10 bg-white/5 ${!dateFilter && "text-white/30"}`}>
                      <span>{dateFilter ? format(dateFilter, "PPP", { locale: he }) : "בחר תאריך יעד"}</span>
                      <CalendarIcon className="h-5 w-5 text-primary opacity-80" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-screen max-w-[calc(100vw-2rem)] p-0 bg-card border-white/10 rounded-2xl overflow-hidden" align="center">
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

            {/* Sticky Actions */}
            <div className="p-6 border-t border-white/10 bg-card/90 backdrop-blur-xl sticky bottom-0 flex gap-4 z-10">
              <Button 
                variant="ghost" 
                className="flex-1 font-bold font-assistant h-14 rounded-xl hover:bg-white/5" 
                onClick={() => { onClearFilters?.(); setIsMobileFilterOpen(false); }}
              >
                נקה הכל
              </Button>
              <Button 
                className="flex-[2] font-bold font-assistant h-14 rounded-xl bg-primary text-white shadow-glow-primary active:scale-95 transition-transform" 
                onClick={() => setIsMobileFilterOpen(false)}
              >
                החל {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''} מסננים
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

