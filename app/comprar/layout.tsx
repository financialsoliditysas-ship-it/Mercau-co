import { AccountSession } from '@/components/account/AccountSession';
import '@/components/buyer/buyer.css';
export const metadata = { title:'Pide y explora | Mercáu', robots:{index:false,follow:false} };
export default function Layout({children}:{children:React.ReactNode}) {
  return <AccountSession>{children}</AccountSession>;
}
