import type { ReportReason } from '@nocap/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'personal_info', label: 'Personal information' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'off_domain', label: 'Off-domain content' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: ReportReason) => void;
}

export function ReportDialog({
  open,
  onOpenChange,
  onSubmit,
}: ReportDialogProps): ReactElement {
  const [reason, setReason] = useState<ReportReason>('spam');

  function handleSubmit(): void {
    onOpenChange(false);
    onSubmit(reason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this claim</DialogTitle>
          <DialogDescription>
            Moderators review every report. Pick the reason that fits best.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="report-reason">Reason</Label>
          <Select
            value={reason}
            // Base UI's Select.Value renders the raw value string unless Root
            // gets an items map — REPORT_REASONS is already {value,label}[].
            items={REPORT_REASONS}
            onValueChange={(value) => {
              // Options come from REPORT_REASONS, so the cast is safe.
              setReason(value as ReportReason);
            }}
          >
            <SelectTrigger id="report-reason">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {REPORT_REASONS.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleSubmit}>
            Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
