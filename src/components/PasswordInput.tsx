import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  className?: string;
}

const PasswordInput = ({ value, onChange, placeholder, autoComplete, className }: PasswordInputProps) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        className={className || "w-full h-11 px-4 pl-10 rounded-md border border-border bg-input font-assistant focus-double-ring transition-all duration-150"}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default PasswordInput;
