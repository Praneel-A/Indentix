import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "pointer-events-none fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:right-0 sm:top-0 sm:flex-col md:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

type ToastVariant = "default" | "destructive" | "success";

const toastVariants: Record<ToastVariant, string> = {
  default: "border border-stone-200 bg-white text-stone-900",
  destructive: "border border-red-200 bg-red-50 text-red-900",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-900",
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & { variant?: ToastVariant }
>(({ className, variant = "default", ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      "pointer-events-auto relative flex w-full items-start gap-3 rounded-xl p-4 pr-10 shadow-lg",
      toastVariants[variant],
      className,
    )}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastClose = ToastPrimitive.Close;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

export type ToastPayload = { title: string; description?: string; variant?: ToastVariant };

type Ctx = { toast: (p: ToastPayload) => void };

const ToastContext = React.createContext<Ctx | null>(null);

function AppToastBridge({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<(ToastPayload & { id: string; open: boolean })[]>([]);

  const toast = React.useCallback((p: ToastPayload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setItems((prev) => [...prev, { ...p, id, open: true }]);
  }, []);

  const dismiss = (id: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, open: false } : x)));
    window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 300);
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastProvider duration={4500} swipeDirection="right">
        {children}
        {items.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            open={t.open}
            onOpenChange={(o) => {
              if (!o) dismiss(t.id);
            }}
          >
            {t.variant === "success" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />}
            {t.variant === "destructive" && <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />}
            {(!t.variant || t.variant === "default") && <Info className="h-5 w-5 shrink-0 text-stone-600" aria-hidden />}
            <div className="grid gap-1">
              <ToastTitle>{t.title}</ToastTitle>
              {t.description && <ToastDescription>{t.description}</ToastDescription>}
            </div>
            <ToastClose
              className="absolute right-2 top-2 rounded-md p-1 text-stone-500 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-stone-900"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" aria-hidden />
            </ToastClose>
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}

function useToast(): Ctx {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within AppToastBridge");
  return ctx;
}

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, AppToastBridge, useToast };
