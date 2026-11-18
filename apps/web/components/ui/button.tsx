import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '@/lib/utils';
const styles = cva('button', {variants:{variant:{default:'primary',outline:'outline',ghost:'ghost'},size:{default:'',small:'small'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,...props}: React.ComponentProps<'button'> & VariantProps<typeof styles> & {asChild?:boolean}) {
  const Component=asChild?Slot:'button';
  return <Component className={cn(styles({variant,size}),className)} {...props}/>;
}
