import { format } from 'date-fns';

export const formatDateToUS = (date: Date) => {
  return format(date, 'MMM, dd yyyy');
};
