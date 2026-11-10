"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cx } from "@/lib/cx";
import { controlClass } from "./control-class";
import { Icon } from "./icons";

/** Lists at least this long get a search box. */
const SEARCH_FROM = 13;
const GAP = 4;
const VIEWPORT_MARGIN = 8;
const MAX_LIST_HEIGHT = 320;
const MIN_FLIP_HEIGHT = 200;

interface Option {
  value: string;
  label: string;
  disabled: boolean;
}

const textOf = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : isValidElement(n) ? textOf((n as ReactElement<{ children?: ReactNode }>).props.children) : ""))
    .join("");

/** Reads the <option> children (also inside fragments and arrays). */
function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child): Option[] => {
    if (!isValidElement(child)) return [];
    const el = child as ReactElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>;
    if (el.type === Fragment) return readOptions(el.props.children);
    if (el.type !== "option") return [];
    const label = textOf(el.props.children);
    return [{ value: el.props.value === undefined ? label : String(el.props.value), label, disabled: Boolean(el.props.disabled) }];
  });
}

/** "— Name" marks a sub-option in the existing option lists: shown indented, without the dash. */
const isChild = (label: string) => label.startsWith("— ");
const plain = (label: string) => (isChild(label) ? label.slice(2) : label);

/**
 * Styled dropdown with the same props as a native <select> (`value` / `defaultValue`, `onChange` with
 * `e.target.value`, `name`, <option> children), so forms and filters work the same. A hidden input carries the value
 * for form submits. Follows the ARIA select-only combobox pattern. The list opens in the browser's top layer, so
 * tables, sidebars and modal dialogs never clip it.
 */
export function Select({ id, name, value, defaultValue, onChange, disabled, className, children, title, noSearch, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { noSearch?: boolean }) {
  const options = readOptions(children);
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue === undefined ? undefined : String(defaultValue));
  // Filters re-render with a new default after navigation (e.g. "Clear filters"): follow it.
  const [lastDefault, setLastDefault] = useState(defaultValue);
  if (defaultValue !== lastDefault) {
    setLastDefault(defaultValue);
    setInternal(defaultValue === undefined ? undefined : String(defaultValue));
  }
  const current = controlled ? String(value) : internal;
  // Like a native select, nothing chosen means the first enabled option.
  const selected = options.find((o) => o.value === current) ?? options.find((o) => !o.disabled) ?? options[0];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const autoId = useId();
  const listId = `${autoId}-list`;
  const optionId = (i: number) => `${autoId}-opt-${i}`;

  const searchable = !noSearch && options.length >= SEARCH_FROM;
  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => plain(o.label).toLowerCase().includes(q)) : options;

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o === selected)));
    setOpen(true);
  };
  const closeList = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (o: Option) => {
    if (o.disabled) return;
    if (!controlled) setInternal(o.value);
    if (o.value !== selected?.value) {
      const target = { value: o.value, name, id };
      onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>);
    }
    closeList();
  };
  const move = (from: number, delta: 1 | -1) => {
    for (let i = from + delta; i >= 0 && i < visible.length; i += delta) {
      if (!visible[i].disabled) {
        setActive(i);
        return;
      }
    }
  };
  /** Letters jump to the next matching option (lists without a search box). */
  const typeAhead = (key: string, now: number) => {
    typed.current = { text: now - typed.current.at < 700 ? typed.current.text + key.toLowerCase() : key.toLowerCase(), at: now };
    const i = options.findIndex((o) => !o.disabled && plain(o.label).toLowerCase().startsWith(typed.current.text));
    if (i >= 0) setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const handled = () => {
      e.preventDefault();
      e.stopPropagation(); // Keys must not also reach a surrounding widget (date picker, dialog).
    };
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        handled();
        openList();
      } else if (printable) {
        handled();
        openList();
        if (searchable) setQuery(e.key);
        else typeAhead(e.key, e.timeStamp);
      }
      return;
    }
    if (e.key === "Escape") {
      handled();
      closeList();
    } else if (e.key === "Tab") {
      closeList(false);
    } else if (e.key === "ArrowDown") {
      handled();
      move(active, 1);
    } else if (e.key === "ArrowUp") {
      handled();
      move(active, -1);
    } else if (e.key === "Home") {
      handled();
      move(-1, 1);
    } else if (e.key === "End") {
      handled();
      move(visible.length, -1);
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      handled();
      if (visible[active]) choose(visible[active]);
    } else if (printable && !searchable) {
      handled();
      typeAhead(e.key, e.timeStamp);
    }
  };

  // Places the panel under the trigger, or above it when there is more room there.
  const place = () => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;
    const box = trigger.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - GAP - VIEWPORT_MARGIN;
    const above = box.top - GAP - VIEWPORT_MARGIN;
    const up = below < MIN_FLIP_HEIGHT && above > below;
    panel.style.minWidth = `${box.width}px`;
    panel.style.maxHeight = `${Math.min(MAX_LIST_HEIGHT + (searchable ? 48 : 0), up ? above : below)}px`;
    const width = panel.offsetWidth;
    panel.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(box.left, window.innerWidth - width - VIEWPORT_MARGIN))}px`;
    panel.style.top = up ? "auto" : `${box.bottom + GAP}px`;
    panel.style.bottom = up ? `${window.innerHeight - box.top + GAP}px` : "auto";
  };

  useLayoutEffect(() => {
    if (!open) return;
    panelRef.current?.showPopover();
    place();
    // Phones: don't pop up the keyboard just because the list opened; the search box is one tap away.
    if (searchable && !window.matchMedia("(pointer: coarse)").matches) searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per opening
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) closeList(false);
    };
    const onMove = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) place();
    };
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers only touch refs and setters
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[id="${optionId(active)}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId is stable
  }, [open, active, query]);

  const passThrough = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith("aria-") || k.startsWith("data-")));
  const custom = className ?? "";

  return (
    <>
      {name && <input type="hidden" name={name} value={selected?.value ?? ""} disabled={disabled} />}
      <button
        {...passThrough}
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable && visible[active] ? optionId(active) : undefined}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          controlClass,
          "flex items-center justify-between gap-2 text-left disabled:text-muted",
          !/(^|\s)h-/.test(custom) && "h-10",
          /(^|\s)w-/.test(custom) ? "" : "w-full",
          open && "border-brand ring-3 ring-brand/25",
          custom,
        )}
      >
        <span className="min-w-0 truncate">{selected ? plain(selected.label) : ""}</span>
        <Icon name="chevronDown" className={cx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          ref={panelRef}
          popover="manual"
          onKeyDown={onKeyDown}
          className="fixed right-auto m-0 max-w-[min(26rem,calc(100vw-1rem))] overflow-hidden rounded-ui border border-line bg-surface p-0 text-foreground shadow-xl"
        >
          <div className="flex h-full max-h-[inherit] flex-col">
            {searchable && (
              <div className="relative shrink-0 border-b border-line p-1.5">
                <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-label="Search options"
                  aria-expanded
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-activedescendant={visible[active] ? optionId(active) : undefined}
                  autoComplete="off"
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  className="h-9 w-full rounded-ui bg-surface-muted pr-3 pl-8 text-base placeholder:text-muted focus:ring-2 focus:ring-brand/25 focus:outline-none sm:text-sm"
                />
              </div>
            )}
            <ul ref={listRef} id={listId} role="listbox" aria-label="Options" className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1">
              {visible.map((o, i) => {
                const isSelected = o === selected;
                return (
                  <li
                    key={`${o.value}-${i}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onPointerMove={() => !o.disabled && i !== active && setActive(i)}
                    onClick={() => choose(o)}
                    className={cx(
                      "flex items-center justify-between gap-3 rounded-md py-2 pr-2.5 text-sm",
                      isChild(o.label) ? "pl-6" : "pl-2.5",
                      o.disabled ? "cursor-not-allowed text-muted opacity-60" : "cursor-pointer",
                      i === active && !o.disabled && "bg-brand-soft",
                      isSelected && "font-semibold text-brand",
                    )}
                  >
                    <span className="min-w-0">{plain(o.label)}</span>
                    {isSelected && <Icon name="check" className="size-4 shrink-0" />}
                  </li>
                );
              })}
              {visible.length === 0 && <li role="presentation" className="px-2.5 py-3 text-center text-sm text-muted">No matches</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
