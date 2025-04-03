import { HelpCircle, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "./ui/table";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AccountType, AssetData, Order } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { OrderForm } from "./OrderForm";
import { toast, Toaster } from "sonner";

export function Orders({
  accounts,
  assetsData,
  jobsExecuted,
}: {
  accounts: AccountType[];
  assetsData: AssetData[];
  jobsExecuted: number;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const addNewOrder = (order: Order) => {
    setOrders((orders) => [order, ...orders]);
    toast.success("Order placed successfully", {
      description: `Order ID: ${order.id}`,
    });
  };

  useEffect(() => {
    (async () => {
      const orders: Order[] = await invoke("get_orders_cmd");
      setOrders(orders);
    })();
  }, [jobsExecuted]);

  return (
    <div className="space-y-6">
      <Toaster />
      <Card>
        <CardHeader>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShoppingCart className="h-6 w-6" />
                Previous orders
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Only the orders passed with this program are shown here.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <DialogTrigger>Place order</DialogTrigger>
            </div>
            <DialogContent>
              <OrderForm
                accounts={accounts}
                assetsData={assetsData}
                addNewOrder={addNewOrder}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.args.symbol}</td>
                  <td>{order.args.quantity}</td>
                  <td>{order.price}</td>
                  <td>{order.args.side}</td>
                  <td>{order.args.account}</td>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
