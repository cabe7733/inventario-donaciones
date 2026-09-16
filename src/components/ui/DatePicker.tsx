import { DatePicker as HeroDatePicker, DateField, Calendar, Label } from '@heroui/react';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { inputClass } from './Field';

interface DatePickerProps {
  id?: string;
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function toCalendarDate(dateStr: string): CalendarDate | null {
  if (!dateStr) return null;
  try {
    return parseDate(dateStr);
  } catch {
    return null;
  }
}

function fromCalendarDate(date: CalendarDate | null): string {
  return date?.toString() ?? '';
}

export function DatePicker({ id: _id, value, onChange, min, max, disabled, required, className }: DatePickerProps) {
  return (
    <HeroDatePicker
      value={toCalendarDate(value)}
      onChange={(date) => onChange(fromCalendarDate(date))}
      minValue={min ? toCalendarDate(min) : undefined}
      maxValue={max ? toCalendarDate(max) : undefined}
      isDisabled={disabled}
      isRequired={required}
      className={className}
    >
      <Label className="sr-only" />
      <DateField.Group className={inputClass + ' pr-0'}>
        <DateField.Input className="flex gap-0.5 items-center">
          {(segment) => <DateField.Segment segment={segment} className="outline-none focus:bg-primary-500/20 focus:text-primary-600 dark:focus:text-primary-300 rounded px-0.5" />}
        </DateField.Input>
        <DateField.Suffix className="flex items-center border-l border-border-default/60 pl-2">
          <HeroDatePicker.Trigger className="text-text-secondary hover:text-fg transition-colors">
            <HeroDatePicker.TriggerIndicator />
          </HeroDatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <HeroDatePicker.Popover className="rounded-2xl border border-border bg-surface-card p-3 shadow-elev-4 backdrop-blur-md z-50">
        <Calendar className="p-1">
          <Calendar.Header className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
            <Calendar.NavButton slot="previous" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" />
            <Calendar.Heading className="text-body font-semibold text-fg" />
            <Calendar.NavButton slot="next" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" />
          </Calendar.Header>
          <Calendar.Grid className="w-full border-collapse">
            <Calendar.GridHeader className="text-caption font-semibold text-text-tertiary">
              {(day) => <Calendar.HeaderCell className="p-1 text-center">{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => (
                <Calendar.Cell
                  date={date}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-body-sm transition-all hover:bg-primary-500/15 data-[selected]:bg-primary-500 data-[selected]:text-white font-medium cursor-pointer"
                />
              )}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </HeroDatePicker.Popover>
    </HeroDatePicker>
  );
}
