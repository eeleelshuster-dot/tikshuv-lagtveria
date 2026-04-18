import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
          <div className="max-w-md w-full bg-card shadow-lg border border-border rounded-lg p-8 text-center animate-fade-in space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold font-rubik text-foreground">
              שגיאת מערכת בלתי צפויה
            </h2>
            <p className="text-muted-foreground font-assistant text-sm">
              {this.props.fallbackMessage || 
                "אירעה שגיאה חמורה בעת טעינת הדף. המידע נרשם והועבר לצוות התמיכה."}
            </p>
            
            <div className="pt-4">
              <Button 
                onClick={() => window.location.reload()} 
                variant="hero"
                className="w-full flex gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                רענן דף
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
