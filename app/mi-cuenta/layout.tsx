import { AccountSession } from "@/components/account/AccountSession";
import "@/components/account/account-workspace.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AccountSession>{children}</AccountSession>;
}
