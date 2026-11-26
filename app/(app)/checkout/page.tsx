import type { Metadata } from "next";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: "Tính tiền" };

export default function CheckoutPage() {
  return <CheckoutView />;
}
