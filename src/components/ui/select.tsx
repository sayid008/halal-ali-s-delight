"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  selectedLabel: string;
  setSelectedLabel: (label: string) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used within a Select");
  }
  return context;
}

export function Select({
  children,
  value = "",
  defaultValue = "",
  onValueChange,
  open: controlledOpen,
  onOpenChange,
}: {
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (val: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const currentValue = value !== undefined ? value : uncontrolledValue;
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const handleSetOpen = React.useCallback(
    (nextOpenOrUpdater: boolean | ((prev: boolean) => boolean)) => {
      const nextOpen =
        typeof nextOpenOrUpdater === "function" ? nextOpenOrUpdater(isOpen) : nextOpenOrUpdater;
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, isOpen, onOpenChange],
  );

  const handleValueChange = React.useCallback(
    (newVal: string) => {
      if (value === undefined) {
        setUncontrolledValue(newVal);
      }
      onValueChange?.(newVal);
      handleSetOpen(false);
    },
    [value, onValueChange, handleSetOpen],
  );

  return (
    <SelectContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleValueChange,
        open: isOpen,
        setOpen: handleSetOpen,
        triggerRef,
        selectedLabel,
        setSelectedLabel,
      }}
    >
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, id, onClick, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useSelectContext();

  const setCombinedRef = (node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  return (
    <button
      ref={setCombinedRef}
      id={id}
      type="button"
      role="combobox"
      aria-expanded={open}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          setOpen((prev) => !prev);
        }
      }}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn("h-4 w-4 opacity-50 transition-transform duration-200", open && "rotate-180")}
      />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

export function SelectValue({
  placeholder,
  children,
}: {
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const { value, selectedLabel } = useSelectContext();
  const display = children || selectedLabel || value || placeholder || "";
  const isPlaceholder = !children && !selectedLabel && !value;

  return (
    <span className={cn("truncate text-left", isPlaceholder && "text-muted-foreground")}>
      {display}
    </span>
  );
}

export const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useSelectContext();
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    // Close when clicking outside
    React.useEffect(() => {
      if (!open) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (
          contentRef.current &&
          !contentRef.current.contains(e.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [open, setOpen, triggerRef]);

    if (!open) return null;

    return (
      <div
        ref={(node) => {
          contentRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn(
          "absolute z-50 mt-1 max-h-60 w-full min-w-[8rem] overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md p-1 animate-in fade-in-0 zoom-in-95 duration-100",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean }
>(({ className, children, value: itemValue, disabled, onClick, ...props }, ref) => {
  const { value, onValueChange, setSelectedLabel } = useSelectContext();
  const isSelected = value === itemValue;

  React.useEffect(() => {
    if (isSelected && typeof children === "string") {
      setSelectedLabel(children);
    }
  }, [isSelected, children, setSelectedLabel]);

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isSelected}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        if (typeof children === "string") {
          setSelectedLabel(children);
        }
        onValueChange(itemValue);
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
        isSelected && "bg-accent/60 font-medium",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {isSelected && (
        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center text-primary">
          <Check className="h-4 w-4" />
        </span>
      )}
    </div>
  );
});
SelectItem.displayName = "SelectItem";

export const SelectGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-1", className)} {...props} />
);
SelectGroup.displayName = "SelectGroup";

export const SelectLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
    {...props}
  />
);
SelectLabel.displayName = "SelectLabel";

export const SelectSeparator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
);
SelectSeparator.displayName = "SelectSeparator";

export const SelectScrollUpButton = () => null;
export const SelectScrollDownButton = () => null;
