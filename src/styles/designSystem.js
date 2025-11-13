import { cn } from '@/lib/utils';

export const panelPadding = 'px-3 py-4 sm:px-5 lg:px-6 sm:py-6';
export const sectionSpacing = 'space-y-4 sm:space-y-5';
export const layoutBackground = 'bg-slate-50';

export const cardStyles = {
  surface: 'rounded-xl border border-slate-200 bg-white shadow-sm',
  subtle: 'rounded-xl border border-slate-200 bg-slate-50',
  translucent: 'rounded-xl border border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-sm'
};

export const cardPadding = 'p-4 sm:p-5';
export const cardHeader = 'flex flex-col gap-1';
export const cardTitle = 'text-base font-semibold text-slate-900';
export const cardSubtitle = 'text-sm text-slate-500';

const chipBase =
  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold tracking-tight';

export const chipVariants = {
  neutral: `${chipBase} border-slate-200 bg-slate-100 text-slate-700`,
  info: `${chipBase} border-blue-200 bg-blue-50 text-blue-700`,
  success: `${chipBase} border-emerald-200 bg-emerald-50 text-emerald-700`,
  warning: `${chipBase} border-amber-200 bg-amber-50 text-amber-700`,
  danger: `${chipBase} border-rose-200 bg-rose-50 text-rose-700`,
  muted: `${chipBase} border-slate-200 bg-white text-slate-600`
};

export const getChipClasses = (variant = 'neutral') =>
  chipVariants[variant] || chipVariants.neutral;

export const toggleButtonBase =
  'flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

export const toggleIconChip =
  'rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm';

export const statIconWrapper =
  'flex h-10 w-10 items-center justify-center rounded-lg';

export const responsiveCardPadding = (additional) =>
  cn(cardStyles.surface, cardPadding, additional);

