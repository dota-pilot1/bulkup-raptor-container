"use client";

import { createContext, isValidElement, useContext, useEffect, useRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";

import { cn } from "../lib/utils";

type DropdownMenuContextValue = {
  close: () => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

type DropdownMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
  children: ReactNode;
  className?: string;
};

/** 바깥 클릭과 Escape로 닫히는 공통 액션 메뉴. */
export function DropdownMenu({
  open,
  onOpenChange,
  trigger,
  children,
  className,
}: DropdownMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      rootRef.current?.querySelector<HTMLButtonElement>("[data-dropdown-trigger]")?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!isValidElement(trigger)) return null;

  return (
    <DropdownMenuContext.Provider value={{ close: () => onOpenChange(false) }}>
      <div ref={rootRef} className="relative">
        {(() => {
          const triggerProps = trigger.props;
          return (
            <button
              {...triggerProps}
              type={triggerProps.type ?? "button"}
              data-dropdown-trigger
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={(event) => {
                triggerProps.onClick?.(event);
                if (!event.defaultPrevented) onOpenChange(!open);
              }}
            />
          );
        })()}
        {open && (
          <div
            role="menu"
            className={cn(
              "absolute right-0 top-full z-30 mt-2 grid w-52 gap-1 rounded-lg border border-surface-border bg-surface-raised p-2 shadow-xl",
              className,
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownMenuContext.Provider>
  );
}

type DropdownMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  onAction?: () => void;
};

export function DropdownMenuItem({
  className,
  onClick,
  onAction,
  disabled,
  children,
  ...props
}: DropdownMenuItemProps) {
  const menu = useContext(DropdownMenuContext);
  if (!menu) throw new Error("DropdownMenuItem must be used inside DropdownMenu.");

  return (
    <button
      {...props}
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "ui-icon-button h-8 justify-start px-2.5 text-[11px] font-black disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onAction?.();
        menu.close();
      }}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="my-0.5 h-px bg-surface-border-soft" />;
}
