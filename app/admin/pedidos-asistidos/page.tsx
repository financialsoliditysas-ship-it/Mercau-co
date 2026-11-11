import AdminShell from '@/components/admin/AdminShell';
import AssistedOrders from '@/components/admin/AssistedOrders';
export default function Page(){return <AdminShell active="pedidos-asistidos" title="Pedido asistido" description="Registra en menos de un minuto los pedidos recibidos por llamada o WhatsApp y envíalos al flujo normal del restaurante."><AssistedOrders/></AdminShell>;}
