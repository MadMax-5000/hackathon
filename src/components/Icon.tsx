import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  ClipboardIcon,
  Clock01Icon,
  CubeIcon,
  FilterIcon,
  InformationCircleIcon,
  Layers01Icon,
  LockIcon,
  Mail01Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilEdit02Icon,
  PlayCircleIcon,
  RefreshIcon,
  Search01Icon,
  SentIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Tick02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

export type IconName =
  | "tyre"
  | "calendar"
  | "person"
  | "alert"
  | "check"
  | "x"
  | "pen"
  | "redo"
  | "filter"
  | "clock"
  | "lock"
  | "mail"
  | "cube"
  | "info"
  | "chevron"
  | "arrow"
  | "sparkle"
  | "shield"
  | "chart"
  | "layers"
  | "clipboard"
  | "search"
  | "send"
  | "play"
  | "panel-open"
  | "panel-close";

type Props = {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const ICONS: Record<Exclude<IconName, "tyre">, IconSvgElement> = {
  calendar: Calendar03Icon,
  person: UserIcon,
  alert: Alert02Icon,
  check: Tick02Icon,
  x: Cancel01Icon,
  pen: PencilEdit02Icon,
  redo: RefreshIcon,
  filter: FilterIcon,
  clock: Clock01Icon,
  lock: LockIcon,
  mail: Mail01Icon,
  cube: CubeIcon,
  info: InformationCircleIcon,
  chevron: ArrowDown01Icon,
  arrow: ArrowRight01Icon,
  sparkle: SparklesIcon,
  shield: ShieldCheckIcon,
  chart: Analytics01Icon,
  layers: Layers01Icon,
  clipboard: ClipboardIcon,
  search: Search01Icon,
  send: SentIcon,
  play: PlayCircleIcon,
  "panel-open": PanelLeftOpenIcon,
  "panel-close": PanelLeftCloseIcon,
};

export function Icon({ name, size = 20, className, strokeWidth = 1.8 }: Props) {
  if (name === "tyre") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 256 256"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M149.26 159.26C155.09 173.82 163.5 176 168 176s12.91-2.18 18.74-16.74c3.39-8.48 5.26-19.58 5.26-31.26s-1.87-22.78-5.26-31.26C180.91 82.18 172.5 80 168 80s-12.91 2.18-18.74 16.74c-3.39 8.48-5.26 19.58-5.26 31.26s1.87 22.78 5.26 31.26M168 96.2c2.62 2.06 8 13 8 31.8s-5.38 29.74-8 31.8c-2.62-2.06-8-13-8-31.8s5.38-29.74 8-31.8M232 216h-35.59c16.71-18.27 27.59-50.53 27.59-88c0-58.32-26.35-104-60-104H92c-33.65 0-60 45.68-60 104s26.35 104 60 104h140a8 8 0 0 0 0-16M193.74 63.93C202.93 80.91 208 103.67 208 128s-5.07 47.09-14.26 64.07C185.38 207.5 174.82 216 164 216s-21.38-8.5-29.74-23.93C125.07 175.09 120 152.33 120 128s5.07-47.09 14.26-64.07C142.62 48.5 153.18 40 164 40s21.38 8.5 29.74 23.93M48 128c0-2.5.07-5 .17-7.44L80 97.83l24.43 17.45c-.28 4.16-.43 8.41-.43 12.72a180 180 0 0 0 3.07 33.5l-22.42-16a8 8 0 0 0-9.3 0l-23.74 17A161 161 0 0 1 48 128m14.26-64.07C70.62 48.5 81.18 40 92 40h39.59c-11.9 13-20.84 33.12-25 57.16L84.65 81.49a8 8 0 0 0-9.3 0L50.49 99.25C52.85 86 56.83 74 62.26 63.93m0 128.14a100 100 0 0 1-5.94-13.32L80 161.83l33.94 24.24c4.6 12 10.6 22.22 17.65 29.93H92c-10.82 0-21.38-8.5-29.74-23.93" />
      </svg>
    );
  }

  return (
    <HugeiconsIcon
      icon={ICONS[name]}
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden="true"
    />
  );
}
