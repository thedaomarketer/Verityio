"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Camera, Plus } from "lucide-react";
import { toast } from "sonner";

import { createExpenseAction, type ActionResult } from "@/lib/actions/expenses";
import { useAutoOpen } from "@/hooks/use-auto-open";
import { localDateString } from "@/lib/calculations/local-time";
import { useI18n } from "@/lib/i18n/client";
import { uploadReceipt } from "./upload-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: ActionResult = {};

const CATEGORIES = ["meals", "transport", "supplies", "equipment", "lodging", "other"] as const;

export function CreateExpenseDialog({
  jobs,
  timezone,
  userId,
}: {
  jobs: { id: string; name: string }[];
  timezone: string;
  userId: string;
}) {
  const { m } = useI18n();
  const [open, setOpen] = useAutoOpen("1");
  const id = useId();
  const receipt = useRef<File | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);

  // Save the expense, then -- now that it exists to attach to -- upload the
  // chosen receipt straight to storage (never through the form post).
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await createExpenseAction(prev, formData);
    const file = receipt.current;
    if (!result.error && result.id && file) {
      const error = await uploadReceipt(userId, result.id, file);
      if (error) toast.error(error === "tooLarge" ? m.uploads.tooLarge : error === "unsupported" ? m.uploads.unsupported : m.errors.uploadFailed);
    }
    return result;
  }, initialState);

  useEffect(() => {
    if (!pending && state === initialState) return;
    // Close the dialog once the action reports success; useActionState
    // gives no other hook into "the action just finished".
    if (!pending && !state.error) setOpen(false);
  }, [pending, state, setOpen]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          receipt.current = null;
          setReceiptName(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> {m.expenses.addExpense}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{m.expenses.addExpenseTitle}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-amount`}>{m.common.amount}</Label>
              <Input id={`${id}-amount`} name="amount" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-expenseDate`}>{m.common.date}</Label>
              <Input id={`${id}-expenseDate`} name="expenseDate" type="date" defaultValue={localDateString(new Date(), timezone)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-category`}>{m.common.category}</Label>
            <Select name="category" defaultValue="other">
              <SelectTrigger className="w-full" id={`${id}-category`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {m.expenses.categories[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {jobs.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-jobId`}>{m.common.jobOptional}</Label>
              <Select name="jobId">
                <SelectTrigger className="w-full" id={`${id}-jobId`}>
                  <SelectValue placeholder={m.common.none} />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${id}-description`}>{m.common.description}</Label>
            <Textarea id={`${id}-description`} name="description" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-receipt`}>{m.uploads.receiptOptional}</Label>
            {/* No `name`: the file never rides along in the form post; it's uploaded straight to storage after saving. */}
            <label
              htmlFor={`${id}-receipt`}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-secondary px-3 text-sm font-medium text-primary"
            >
              <Camera className="size-4 shrink-0" />
              <span className="truncate">{receiptName ?? m.uploads.addReceiptPhoto}</span>
            </label>
            <input
              id={`${id}-receipt`}
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                receipt.current = file;
                setReceiptName(file ? file.name || m.uploads.photoSelected : null);
              }}
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? (receiptName ? m.uploads.uploading : m.common.saving) : m.expenses.saveExpense}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
