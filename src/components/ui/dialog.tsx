"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog");
  }
  return context;
}

interface DialogProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  asChild,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { onOpenChange } = useDialogContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      onOpenChange(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(true);
        }
      },
    });
  }

  return (
    <button type="button" className={className} onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { onOpenChange } = useDialogContext();

    return (
      <div
        ref={ref}
        onClick={() => onOpenChange(false)}
        className={cn(
          "fixed inset-0 z-50 bg-black/80 backdrop-blur-xs animate-in fade-in-0 duration-200",
          className,
        )}
        {...props}
      />
    );
  },
);
DialogOverlay.displayName = "DialogOverlay";

export const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, onClick, ...props }, ref) => {
  const { onOpenChange } = useDialogContext();

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(false);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
});
DialogClose.displayName = "DialogClose";

export const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext();

    // Close on Escape key
    React.useEffect(() => {
      if (!open) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onOpenChange(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onOpenChange]);

    // Lock body scroll when open
    React.useEffect(() => {
      if (open) {
        const originalStyle = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = originalStyle;
        };
      }
    }, [open]);

    if (!open) return null;

    return (
      <DialogPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <DialogOverlay />
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative z-50 w-full max-w-lg rounded-2xl border border-border bg-background p-4 sm:p-6 shadow-2xl duration-200 animate-in fade-in-0 zoom-in-95 my-auto max-h-[90vh] overflow-y-auto",
              className,
            )}
            {...props}
          >
            {children}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";
