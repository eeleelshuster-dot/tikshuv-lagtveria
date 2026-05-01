import { useState, useEffect } from "react";
import { Search, Calendar as CalendarIcon, Filter, X } from "lucide-react";
import { format, isFuture, isFriday, isSaturday } from "date-fns";
import { he } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

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
  onClearFilters
}: FilterPanelProps) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Sync with URL Query Params could be managed in the parent, or done here if we prefer hook-based sync.
  // The requirements say: "Support query params: status, department, q, date"
  // It's usually better to manage URL state in the parent or custom hook to keep this component pure,
  // but we can ensure the props represent the state.
  
  return (
    <div className="bg-card rounded-lg p-4 shadow-md border border-border mb-4 animate-in fade-in">
      <div className="flex items-center gap-2 mb-3 text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span className="font-rubik font-medium text-sm">סינון וחיפוש</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pr-10 pl-4 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
            placeholder="חיפוש לפי שם או ת.ז / מספר פנייה..."
          />
        </div>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-4 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="sent">נשלח</option>
          <option value="in_progress">בטיפול המדור</option>
          <option value="forwarded">הועבר לגורם הרלוונטי</option>
          <option value="resolved">טופל</option>
          <option value="closed">הפנייה נסגרה</option>
        </select>

        {/* Department Dropdown */}
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="h-10 px-4 rounded-md border border-border bg-input font-assistant text-sm focus-double-ring transition-all duration-150"
        >
          <option value="all">כל המדורים</option>
          {['גיוס','תו״מ','בקרה','ברה״ן','רפואי','פסיכוטכני','פרט','חרדים','קהילה','שלוחת חזון','מל״ג / סמל״ג'].map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>

        {/* Date Picker */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`h-10 justify-start text-right font-assistant ${!dateFilter && "text-muted-foreground"}`}
            >
              <CalendarIcon className="ml-2 h-4 w-4" />
              {dateFilter ? format(dateFilter, "PPP", { locale: he }) : <span>בחר תאריך</span>}
              {dateFilter && (
                <X 
                  className="mr-auto h-4 w-4 opacity-50 hover:opacity-100" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateFilter(undefined);
                  }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end" autoFocus>
            <div className="flex justify-between items-center p-2 border-b">
              <span className="font-rubik text-sm font-medium pr-2">בחירת תאריך</span>
              <Button variant="ghost" size="sm" onClick={() => setIsCalendarOpen(false)} className="h-6 w-6 p-0 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={(date) => {
                setDateFilter(date);
                setIsCalendarOpen(false); // Auto close on select
              }}
              locale={he}
              disabled={(date) => isFuture(date) || isFriday(date) || isSaturday(date)}
              initialFocus
              className="font-assistant"
            />
          </PopoverContent>
        </Popover>

        {/* Show Archived Toggle */}
        {setShowArchived && (
          <div className="flex items-center justify-between px-3 h-10 rounded-md border border-border bg-input/50">
            <span className="text-xs font-assistant text-muted-foreground">הצג ארכיון</span>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${showArchived ? 'bg-primary' : 'bg-input'}`}
            >
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${showArchived ? '-translate-x-4' : '-translate-x-0.5'}`} />
            </button>
          </div>
        )}
      </div>
      
      {onClearFilters && (searchQuery || statusFilter !== 'all' || departmentFilter !== 'all' || dateFilter) && (
        <div className="flex justify-end mt-3">
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs text-muted-foreground hover:text-foreground">
            נקה סינונים
          </Button>
        </div>
      )}
    </div>
  );
};
