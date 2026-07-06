import { createPortal } from "react-dom";
import { useEffect } from "react";
import type { MouseEventHandler, ReactNode } from "react";

type AppModalOverlayProps = {
  children: ReactNode;
  onDismiss?: MouseEventHandler<HTMLDivElement>;
  field?: boolean;
  className?: string;
};

export function AppModalOverlay({
  children,
  onDismiss,
  field = false,
  className = "",
}: AppModalOverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const overlayClassName = [
    "modal-overlay",
    field ? "modal-overlay--field" : "",
    className,
  ].filter(Boolean).join(" ");

  return createPortal(
    <div className={overlayClassName} role="presentation" onClick={onDismiss}>
      {children}
    </div>,
    document.body,
  );
}
