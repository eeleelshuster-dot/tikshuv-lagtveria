import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Filter, X } from "lucide-react";

const DebugTracePage = () => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(true);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  console.log("[DebugTrace] Rendered. isCalendarOpen:", isCalendarOpen, "isMobileFilterOpen:", isMobileFilterOpen);

  return (
    <div className="p-10 bg-slate-900 min-h-screen text-white" dir="rtl">
      <h1 className="text-2xl mb-5">Date Picker Trace Isolation</h1>
      
      <div className="fixed inset-0 z-[60]">
        <div 
          className="absolute inset-0 bg-background/90 backdrop-blur-md" 
          onClick={(e) => {
            console.log("[DebugTrace] Backdrop Clicked!");
            // setIsMobileFilterOpen(false); // Commented out to prevent closing during trace
          }} 
        />
        <div 
          className="absolute bottom-0 left-0 right-0 bg-card border-t border-white/10 rounded-t-[2.5rem] max-h-[85vh] flex flex-col shadow-2xl p-6"
          onClick={() => console.log("[DebugTrace] Modal Content Clicked")}
        >
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] px-1">תאריך פתיחה</label>
            <Popover 
              open={isCalendarOpen} 
              onOpenChange={(open) => {
                console.log("[DebugTrace] Popover onOpenChange ->", open);
                setIsCalendarOpen(open);
              }}
            >
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`w-full h-14 justify-between font-bold font-assistant rounded-xl border-white/10 bg-white/5 ${!dateFilter && "text-white/30"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log("[DebugTrace] Calendar Trigger Clicked");
                  }}
                >
                  <span>{dateFilter ? format(dateFilter, "PPP", { locale: he }) : "בחר תאריך יעד"}</span>
                  <CalendarIcon className="h-5 w-5 text-primary opacity-80" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-screen max-w-[calc(100vw-2rem)] p-0 bg-card border-white/10 rounded-2xl overflow-hidden z-[9999]" 
                align="center"
                onPointerDownOutside={(e) => {
                  console.log("[DebugTrace] Popover PointerDownOutside - Prevented default");
                  e.preventDefault();
                }}
                onInteractOutside={(e) => {
                  console.log("[DebugTrace] Popover InteractOutside - Prevented default");
                  e.preventDefault();
                }}
              >
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={(date) => { 
                    console.log("[DebugTrace] Date Selected:", date);
                    setDateFilter(date); 
                    setIsCalendarOpen(false); 
                  }}
                  locale={he}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugTracePage;
