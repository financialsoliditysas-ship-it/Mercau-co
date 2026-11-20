import {isFoodBusiness} from './catalog-validation';

export function catalogProductLimit(category:string,commercePlan?:string) {
  const plan=commercePlan||'presencia';
  if(plan!=='presencia')return null;
  return isFoodBusiness(category)?10:15;
}
