import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from './input';
import { Label } from './label';

/**
 * Enhanced Input component with validation states and helper text
 */
const FormInput = React.forwardRef(({ 
	className,
	label,
	error,
	success,
	helperText,
	required,
	id,
	...props 
}, ref) => {
	const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
	const errorId = error ? `${inputId}-error` : undefined;
	const helperId = helperText && !error ? `${inputId}-helper` : undefined;

	return (
		<div className="space-y-1.5">
			{label && (
				<Label htmlFor={inputId} className="text-sm font-medium text-slate-700">
					{label}
					{required && <span className="text-red-500 ml-1">*</span>}
				</Label>
			)}
			<div className="relative">
				<Input
					id={inputId}
					ref={ref}
					className={cn(
						error && "border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500",
						success && "border-green-500 focus-visible:ring-green-500 focus-visible:border-green-500",
						(error || success) && "pr-10",
						className
					)}
					aria-invalid={error ? 'true' : 'false'}
					aria-describedby={error ? errorId : helperId}
					{...props}
				/>
				{error && (
					<div className="absolute right-3 top-1/2 -translate-y-1/2">
						<AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
					</div>
				)}
				{success && !error && (
					<div className="absolute right-3 top-1/2 -translate-y-1/2">
						<CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
					</div>
				)}
			</div>
			{error && (
				<p 
					id={errorId}
					className="text-xs text-red-600 flex items-center gap-1.5"
					role="alert"
				>
					<AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
					<span>{error}</span>
				</p>
			)}
			{helperText && !error && (
				<p 
					id={helperId}
					className="text-xs text-slate-500"
				>
					{helperText}
				</p>
			)}
		</div>
	);
});
FormInput.displayName = 'FormInput';

export { FormInput };

