import { z } from 'zod';

// Login form validation schema
export const loginSchema = z.object({
	email: z
		.string()
		.min(1, 'Email é obrigatório')
		.email('Email inválido')
		.toLowerCase()
		.trim(),
	password: z
		.string()
		.min(1, 'Senha é obrigatória')
		.min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

// Register form validation schema
export const registerSchema = z.object({
	name: z
		.string()
		.min(1, 'Nome é obrigatório')
		.min(2, 'Nome deve ter pelo menos 2 caracteres')
		.max(50, 'Nome deve ter no máximo 50 caracteres')
		.trim(),
	email: z
		.string()
		.min(1, 'Email é obrigatório')
		.email('Email inválido')
		.toLowerCase()
		.trim(),
	password: z
		.string()
		.min(1, 'Senha é obrigatória')
		.min(6, 'Senha deve ter pelo menos 6 caracteres')
		.max(100, 'Senha deve ter no máximo 100 caracteres'),
	confirmPassword: z
		.string()
		.min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
	message: 'As senhas não coincidem',
	path: ['confirmPassword'],
});

// Password reset validation schema
export const passwordResetSchema = z.object({
	email: z
		.string()
		.min(1, 'Email é obrigatório')
		.email('Email inválido')
		.toLowerCase()
		.trim(),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type PasswordResetFormData = z.infer<typeof passwordResetSchema>;

// Validation error type
export type ValidationError = {
	field: string;
	message: string;
};

// Helper function to format Zod errors
export const formatZodError = (error: z.ZodError): ValidationError[] => {
	return error.issues.map((err: z.ZodIssue) => ({
		field: err.path.join('.'),
		message: err.message,
	}));
};
