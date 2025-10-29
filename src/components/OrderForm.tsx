import { ShoppingCart } from "lucide-react";
import { AccountType, AssetData, Order } from "@/types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { getFormattedAccountName } from "@/utils/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "./ui/button";
import { invoke } from "@tauri-apps/api/core";
import { findAssetDataBySymbol } from "@/utils/assetUtils";
import { useState } from "react";
import { toast, Toaster } from "sonner";

export function OrderForm({
  accounts,
  assetsData,
  addNewOrder,
}: {
  accounts: AccountType[];
  assetsData: AssetData[];
  addNewOrder: (order: Order) => void;
}) {
  const [waitingForOrder, setWaitingForOrder] = useState<boolean>(false);

  const formSchema = z.object({
    symbol: z.string().nonempty("Asset is required"),
    account: z
      .string()
      .nonempty("Account is required")
      .default(
        accounts.find((a) => a.name.toUpperCase().includes("PEA"))?.id ||
          (accounts.length > 0 ? accounts[0].id : ""),
      ),
    quantity: z.coerce
      .number()
      .min(1, "Amount must be greater than 0")
      .int("Amount must be a whole number")
      .default(1),
    side: z.enum(["buy", "sell"]).default("buy"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { handleSubmit } = form;

  const onSubmit = handleSubmit(async (data) => {
    try {
      setWaitingForOrder(true);
      const order: Order = await invoke("new_order_cmd", data);
      addNewOrder(order);
      toast.success(`Order ${order.id} placed successfully`);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        toast.error("An error occurred while placing the order.", {
          description: error.message,
          duration: 15000,
        });
      }
    }
    setWaitingForOrder(false);
  });

  const totalPrice =
    (findAssetDataBySymbol(assetsData, form.watch("symbol"))?.quotes[
      (findAssetDataBySymbol(assetsData, form.watch("symbol"))?.quotes.length ||
        0) - 1
    ].close || 0) * form.watch("quantity");

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent>
          <p>
            {accounts.length} accounts found. Please add an account to place an
            order.
          </p>
        </CardContent>
      </Card>
    );
  } else {
    return (
      <Card>
        <Toaster />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-6 w-6" />
            Place Order
          </CardTitle>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormField
                    name="side"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="side">Type</FormLabel>
                        <FormControl>
                          <Select
                            {...field}
                            onValueChange={field.onChange}
                            defaultValue="buy"
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="buy">Buy</SelectItem>
                              <SelectItem value="sell">Sell</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <FormField
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="quantity">
                          Amount of shares
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
                  name="account"
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
                            )?.id || (accounts.length > 0 ? accounts[0].id : "")
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

              {form.watch("symbol") &&
              form.watch("quantity") &&
              findAssetDataBySymbol(assetsData, form.watch("symbol")) ? (
                <div className="space-y-2 mt-3">
                  <p className="text-sm">
                    Buying {form.watch("quantity")} shares of{" "}
                    {
                      findAssetDataBySymbol(assetsData, form.watch("symbol"))
                        ?.name
                    }{" "}
                    for approximately {totalPrice.toFixed(2)} €
                  </p>
                  {totalPrice < 100 ? (
                    <p className="text-sm text-red-600">
                      The current total value of the order is less than 100 €,
                      your order may be rejected.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={waitingForOrder}>
                Place Order
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    );
  }
}
