export type CommerceCartItem={businessId:string;businessName:string;productId:string;name:string;variantId?:string;variantLabel?:string;unitPrice:number;quantity:number;imageUrl?:string};
export const commerceCartKey='mercau-commerce-cart-v1';
export function readCommerceCart():CommerceCartItem[]{if(typeof window==='undefined')return[];try{const value=JSON.parse(localStorage.getItem(commerceCartKey)||'[]');return Array.isArray(value)?value:[];}catch{return[];}}
export function writeCommerceCart(items:CommerceCartItem[]){localStorage.setItem(commerceCartKey,JSON.stringify(items));window.dispatchEvent(new Event('mercau-commerce-cart'));}
