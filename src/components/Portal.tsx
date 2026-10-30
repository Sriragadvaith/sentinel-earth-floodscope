import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
  container?: Element | null;
}

const emptySubscribe = () => () => {};

export function Portal({ children, container }: PortalProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient) return null;
  const target = container || (typeof document !== "undefined" ? document.body : null);
  if (!target) return null;

  return createPortal(children, target);
}
