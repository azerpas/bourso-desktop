import { Command, Job, OrderArgs, WeeklyMonthly } from "@/types";

export function scheduleToString(schedule: WeeklyMonthly | "daily") {
  if (schedule === "daily") {
    return "Daily";
  } else if (schedule.weekly) {
    return `Weekly: ${schedule.weekly.day}`;
  } else if (schedule.monthly) {
    return `Monthly: ${schedule.monthly.day}`;
  } else {
    return "Unknown";
  }
}

function orderAmountQuantityToString(orderArgs: OrderArgs) {
  if (orderArgs.amount) {
    return `${orderArgs.amount}€ of ${orderArgs.symbol}`;
  } else if (orderArgs.quantity) {
    return `${orderArgs.quantity} shares of ${orderArgs.symbol}`;
  } else {
    return "Unknown amount/quantity";
  }
}

export function commandToString(command: Command) {
  if (command.order) {
    return `Order: ${command.order.side} ${orderAmountQuantityToString(command.order)} ${command.order.symbol}`;
  } else {
    return "Unknown";
  }
}

export function jobToString(job: Job): string {
  return `${scheduleToString(job.schedule)} | ${commandToString(job.command)}`;
}
