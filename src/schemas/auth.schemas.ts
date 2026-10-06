import { z } from "zod";
import { t as translate } from "i18next";

// Lazy messages: resolved when validation runs, so they follow the active language.
const msg = (key: string) => ({ error: () => translate(`auth.validation.${key}`) });

// Login form validation schema
export const loginSchema = z.object({
  email: z.string().min(1, msg("emailRequired")).email(msg("emailInvalid")).toLowerCase().trim(),
  password: z.string().min(1, msg("passwordRequired")).min(6, msg("passwordMin")),
});

// Register form validation schema
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(1, msg("nameRequired"))
      .min(2, msg("nameMin"))
      .max(50, msg("nameMax"))
      .trim(),
    email: z.string().min(1, msg("emailRequired")).email(msg("emailInvalid")).toLowerCase().trim(),
    password: z
      .string()
      .min(1, msg("passwordRequired"))
      .min(6, msg("passwordMin"))
      .max(100, msg("passwordMax")),
    confirmPassword: z.string().min(1, msg("confirmRequired")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: () => translate("auth.validation.passwordsMismatch"),
    path: ["confirmPassword"],
  });

// Password reset validation schema
export const passwordResetSchema = z.object({
  email: z.string().min(1, msg("emailRequired")).email(msg("emailInvalid")).toLowerCase().trim(),
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
    field: err.path.join("."),
    message: err.message,
  }));
};
