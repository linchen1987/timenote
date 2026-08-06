import { RangePicker } from '@rc-component/picker';
import dayjsGenerateConfig from '@rc-component/picker/generate/dayjs';
import enUS from '@rc-component/picker/locale/en_US';
import dayjs, { type Dayjs } from 'dayjs';
import { Calendar, X } from 'lucide-react';
import './date-range-picker.css';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_FORMATS = [DATE_FORMAT, 'YYYY-M-D', 'YYYY/MM/DD', 'YYYY/M/D', 'YYYY.MM.DD', 'YYYY.M.D'];
const PICKER_PREFIX = 'timenote-date-range-picker';

export interface DateRangePickerProps {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  return (
    <div className="inline-flex">
      <RangePicker<Dayjs>
        prefixCls={PICKER_PREFIX}
        value={toPickerRange(from, to)}
        generateConfig={dayjsGenerateConfig}
        locale={enUS}
        format={DATE_FORMATS}
        placeholder={['From', 'To']}
        allowEmpty={[true, true]}
        allowClear={{ clearIcon: <X aria-hidden="true" /> }}
        suffixIcon={<Calendar aria-hidden="true" />}
        needConfirm={false}
        onChange={(_, dates) => onChange(dates?.[0] || null, dates?.[1] || null)}
      />
    </div>
  );
}

function toPickerRange(
  from: string | null,
  to: string | null,
): [Dayjs | null, Dayjs | null] | null {
  if (!from && !to) return null;
  return [toDayjs(from), toDayjs(to)];
}

function toDayjs(value: string | null): Dayjs | null {
  return value ? dayjs(value, DATE_FORMAT, true) : null;
}
