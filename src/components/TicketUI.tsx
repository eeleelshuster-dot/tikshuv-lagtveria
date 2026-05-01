import { CheckCircle2, Clock, PlayCircle, XCircle, Send } from "lucide-react";

export const StatusBadge = ({ status, isConfirmed }: { status: string, isConfirmed?: boolean }) => {
  const configs: Record<string, { label: string, color: string, icon: any }> = {
    sent: { label: "נשלח", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", icon: Send },
    forwarded: { label: "הועבר", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: Send },
    in_progress: { label: "בטיפול", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: PlayCircle },
    resolved: { label: "טופל", color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2 },
    closed: { label: "סגור", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: XCircle },
  };

  const config = configs[status] || configs.sent;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
      {status === 'resolved' && !isConfirmed && (
        <span className="ml-1 animate-pulse text-[10px] bg-orange-500 text-white px-1 rounded">מחכה לאישור</span>
      )}
    </div>
  );
};

export const TicketTimeline = ({ status, updates = [] }: { status: string, updates?: any[] }) => {
  const steps = [
    { key: 'sent', label: 'נשלח' },
    { key: 'in_progress', label: 'בטיפול' },
    { key: 'resolved', label: 'טופל' },
    { key: 'closed', label: 'סגור' }
  ];

  const statusToStep: Record<string, number> = {
    sent: 0,
    forwarded: 0,
    in_progress: 1,
    resolved: 2,
    closed: 3
  };

  const currentStep = statusToStep[status] ?? 0;

  return (
    <div className="w-full py-6">
      <div className="relative flex justify-between">
        {/* Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -translate-y-1/2 z-0" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500" 
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isActive = idx === currentStep;
          
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                isCompleted ? 'bg-primary border-primary text-primary-foreground' : 
                isActive ? 'bg-background border-primary text-primary' : 
                'bg-background border-border text-muted-foreground'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
              </div>
              <span className={`mt-2 text-xs font-rubik ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
