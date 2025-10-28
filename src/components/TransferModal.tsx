import { useState, useEffect } from "react";
import { AccountType } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { ArrowRight, Loader } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { getFormattedAccountName } from "@/utils/format";

const transferFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 10;
      },
      { message: "Amount must be at least €10" }
    )
    .refine(
      (val) => {
        const decimals = val.split(".")[1];
        return !decimals || decimals.length <= 2;
      },
      { message: "Maximum 2 decimal places allowed" }
    ),
  reason: z
    .string()
    .max(50, "Reason must be 50 characters or less")
    .optional()
    .default(""),
});

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceAccount: AccountType | null;
  targetAccount: AccountType | null;
  accounts: AccountType[];
  onTransferComplete?: () => void;
}

export function TransferModal({
  open,
  onOpenChange,
  sourceAccount,
  targetAccount,
  accounts,
  onTransferComplete,
}: TransferModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof transferFormSchema>>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      amount: "",
      reason: "",
    },
  });

  // Reset form when modal opens with new accounts
  useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const handleAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: { onChange: (value: string) => void }
  ) => {
    const value = e.target.value;
    // Allow empty, numbers, and one decimal point with up to 2 decimals
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      field.onChange(value);
    }
  };

  const onSubmit = async (data: z.infer<typeof transferFormSchema>) => {
    if (!sourceAccount || !targetAccount) {
      toast.error("Invalid accounts selected");
      return;
    }

    setLoading(true);
    try {

      await invoke("transfer_funds", {
        sourceAccountId: sourceAccount.id,
        targetAccountId: targetAccount.id,
        amount: parseFloat(data.amount),
        reason: data.reason.trim(),
      });

      toast.success("Transfer initiated successfully");
      handleClose();
      onTransferComplete?.();
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error(`Transfer failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bank Transfer</DialogTitle>
          <DialogDescription>
            Transfer funds between your accounts
          </DialogDescription>
        </DialogHeader>

        {sourceAccount && targetAccount && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Accounts Display */}
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{getFormattedAccountName(sourceAccount, accounts)}</p>
                  <p className="text-xs text-muted-foreground">
                    {sourceAccount.bank_name}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 space-y-1 text-right">
                  <p className="text-sm font-medium">{getFormattedAccountName(targetAccount, accounts)}</p>
                  <p className="text-xs text-muted-foreground">
                    {targetAccount.bank_name}
                  </p>
                </div>
              </div>

              {/* Amount Input */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Amount (€)
                      <span className="text-xs text-muted-foreground ml-2">
                        Minimum €10
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="10.00"
                        disabled={loading}
                        className="text-lg"
                        {...field}
                        onChange={(e) => handleAmountChange(e, field)}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the amount to transfer (max 2 decimal places)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reason Input */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reason
                      <span className="text-xs text-muted-foreground ml-2">
                        {field.value.length}/50
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g., Monthly savings"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a reason for this transfer (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!form.formState.isValid || loading}
                >
                  {loading ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Transfer"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
