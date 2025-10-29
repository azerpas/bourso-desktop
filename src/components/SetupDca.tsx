import React, { useEffect, useState } from "react";
import { AccountType, AssetData, Job, WeeklyMonthly } from "../types";
import { Clock, HelpCircle, Info, Settings, Trash2 } from "lucide-react";
import { getFormattedAccountName } from "@/utils/format";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { platform } from "@tauri-apps/plugin-os";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Separator } from "./ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";

export function SetupDca({
  initialized,
  setInitialized,
  accounts,
  assetsData,
}: {
  initialized: boolean;
  setInitialized: React.Dispatch<React.SetStateAction<boolean>>;
  accounts: AccountType[];
  assetsData: AssetData[];
}) {
  const SCHEDULE_OPTIONS = [
    { label: "Every day", value: "daily" },
    { label: "Every week", value: "weekly" },
    { label: "Every month", value: "monthly" },
  ];

  const [jobs, setJobs] = useState<Job[]>([]);
  const [creatingJob, setCreatingJob] = useState(false);
  // This state is used to switch between amount and quantity
  // amount is the amount of euros to invest
  // quantity is the amount of shares to buy
  //
  // By default, we use quantity
  const [amountInsteadOfQuantity, setAmountInsteadOfQuantity] = useState(false);

  const formSchema = z.object({
    symbol: z.string().nonempty("Asset is required"),
    accountId: z
      .string()
      .nonempty("Account is required")
      .default(
        accounts.find((a) => a.name.toUpperCase().includes("PEA"))?.id ||
          (accounts.length > 0 ? accounts[0].id : ""),
      ),
    amount: z.coerce
      .number()
      .min(1, "Amount must be greater than 0")
      .int("Amount must be a whole number")
      .default(1),
    scheduleType: z
      .string()
      .nonempty("Schedule type is required")
      .default("monthly"),
  });

  useEffect(() => {
    const getDcaJobs = async () => {
      const jobs: Job[] = await invoke("get_scheduled_jobs");
      const filtered = jobs.filter(
        (j) => typeof j.command.order !== "undefined",
      );
      setJobs(filtered);
    };
    getDcaJobs();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { handleSubmit } = form;

  const initScheduler = async () => {
    await invoke("init_dca_scheduler");
    setInitialized(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    setCreatingJob(true);
    const job: Job = {
      schedule:
        data.scheduleType === "weekly"
          ? { weekly: { day: 1 } } // 1st day of the week
          : data.scheduleType === "monthly"
            ? { monthly: { day: 1 } }
            : "daily",
      command: {
        order: {
          side: "buy",
          symbol: data.symbol,
          account: data.accountId,
          amount: amountInsteadOfQuantity ? data.amount : undefined,
          quantity: amountInsteadOfQuantity ? undefined : data.amount,
        },
      },
      id: `${data.scheduleType}order_buy_${data.amount}_${data.symbol}`,
      last_run: Math.floor(Date.now() / 1000),
    };

    try {
      await invoke("add_scheduled_job", {
        job,
      });
      setJobs((prev) => [...prev, job]);
      toast("DCA scheduled", {
        description: "Your DCA has been scheduled successfully",
      });
    } catch (error) {
      console.error(error);
      toast.error("Error scheduling DCA", {
        description: "There was an error scheduling your DCA",
      });
    }
    setCreatingJob(false);
  });

  const formatNextRun = (
    last_run_timestamp: number,
    schedule: WeeklyMonthly | "daily",
  ) => {
    const nextRun =
      schedule === "daily" ? 86400000 : schedule.weekly ? 6.048e8 : 2.628e9;

    const nextRunDate = new Date(last_run_timestamp * 1000 + nextRun);

    const dateHasPassed = nextRunDate < new Date();

    if (dateHasPassed) {
      return "Now";
    }

    return nextRunDate.toLocaleString("en-EN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const deleteDcaScheduledJob = async (id: string) => {
    await invoke("delete_scheduled_job", { jobId: id });
    setJobs(jobs.filter((j) => j.id !== id));
    toast("DCA schedule deleted", {
      description: "Your DCA has been deleted successfully",
    });
  };

  const deactivateDca = async () => {
    await invoke("deactivate_dca_scheduler");
    setInitialized(false);
    toast("DCA scheduler deactivated", {
      description:
        "All further DCA will be stopped until you activate it again",
    });
  };

  if (!initialized) {
    return (
      <DialogContent className="max-w-2xl lg:max-w-screen-md overflow-y-scroll max-h-screen">
        <DialogHeader>
          <DialogTitle>Dollar Cost Averaging</DialogTitle>
        </DialogHeader>
        {platform() === "windows" ? (
          <p>
            Sadly DCA is not available on Windows yet. We are working on it.
          </p>
        ) : (
          <>
            <p>
              You&apos;re about to setup an automatic DCA checker. The program
              will run periodically in the background to check if there&apos;s
              any DCA to execute.
              <br />
              <span className="text-red-600">
                This will not execute any DCA, you still need to create and
                configure them on the next screen.
              </span>
              {platform() === "macos" && (
                <>
                  <br />
                  On MacOS, you will get a pop-up that ask for permission to
                  install the checker. Click on authorize to allow the
                  installation.
                </>
              )}
            </p>
            <DialogFooter>
              <Button onClick={initScheduler}>Access DCA setup</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-w-2xl lg:max-w-screen-md overflow-y-scroll max-h-screen">
      <DialogHeader>
        <DialogTitle>Dollar Cost Averaging</DialogTitle>
      </DialogHeader>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="">Add new DCA</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormField
                      name="symbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="symbol">Asset</FormLabel>
                          <FormControl>
                            <Select
                              {...field}
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select an asset" />
                              </SelectTrigger>
                              <SelectContent>
                                {assetsData.map((asset) => (
                                  <SelectItem
                                    key={asset.symbol}
                                    value={asset.symbol}
                                  >
                                    {asset.symbol} - {asset.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <FormField
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            htmlFor="amount"
                            onClick={() =>
                              setAmountInsteadOfQuantity((prev) => !prev)
                            }
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            Amount{" "}
                            {amountInsteadOfQuantity ? "in euros" : "in shares"}
                            <span className="text-muted-foreground">
                              <Settings className="w-4" />
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Input type="number" defaultValue={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormField
                    name="accountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="account">Account</FormLabel>
                        <FormControl>
                          <Select
                            {...field}
                            onValueChange={field.onChange}
                            defaultValue={
                              accounts.find((a) =>
                                a.name.toUpperCase().includes("PEA"),
                              )?.id ||
                              (accounts.length > 0 ? accounts[0].id : "")
                            }
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {getFormattedAccountName(account, accounts)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />
                <p className="text-sm text-muted-foreground">
                  The DCA will be made at the frequency below if your
                  device is online, else it will be made as soon as your device
                  is back online.
                </p>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <FormField
                      name="scheduleType"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormLabel htmlFor="scheduleType">
                              Frequency
                            </FormLabel>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Choose how often you want to invest</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <FormControl>
                            <Select
                              {...field}
                              onValueChange={field.onChange}
                              defaultValue={"monthly"}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SCHEDULE_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {form.watch("symbol") && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      <Info className="inline" /> Your DCA will be executed
                      <span className="font-medium">
                        {" "}
                        {form.watch("scheduleType")}{" "}
                      </span>
                      for a value of{" "}
                      {amountInsteadOfQuantity ? (
                        <>
                          <span className="font-medium">
                            {form.watch("amount")} €
                          </span>{" "}
                          which is{" "}
                          {(
                            form.watch("amount") /
                            (assetsData.find(
                              (a) => a.symbol === form.watch("symbol"),
                            )?.quotes[0].close || 0)
                          ).toFixed(0)}{" "}
                          share(s) at today&apos;s price of{" "}
                          {
                            assetsData.find(
                              (a) => a.symbol === form.watch("symbol"),
                            )?.quotes[0].close
                          }{" "}
                          €
                        </>
                      ) : (
                        <>
                          <span className="font-medium">
                            {form.watch("amount")} shares{" "}
                          </span>
                          (today&apos;s worth{" "}
                          {(
                            (assetsData.find(
                              (a) => a.symbol === form.watch("symbol"),
                            )?.quotes[0].close || 0) * form.watch("amount")
                          ).toFixed(2)}
                          €)
                        </>
                      )}
                    </p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={creatingJob}>
                  Add Schedule
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Separator />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Existing Schedules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map(
                      ({ id, schedule, command: { order }, last_run }) => {
                        if (order) {
                          return (
                            <TableRow key={id}>
                              <TableCell className="font-medium">
                                {order!.symbol}
                              </TableCell>
                              <TableCell>
                                {
                                  accounts.find((a) => a.id === order!.account)
                                    ?.name
                                }
                              </TableCell>
                              <TableCell>
                                {order!.quantity}
                                {order!.amount && `${order!.amount}€`}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {schedule === "daily"
                                  ? schedule
                                  : schedule.monthly
                                    ? "monthly"
                                    : "weekly"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatNextRun(last_run, schedule)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteDcaScheduledJob(id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                      },
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Deactivate DCA</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Deactivating the DCA will stop all the scheduled DCA from being
              executed until you activate it again.
            </p>
            <Button onClick={deactivateDca} className="w-full">
              Deactivate DCA
            </Button>
          </CardContent>
        </Card>
      </div>
    </DialogContent>
  );
}
