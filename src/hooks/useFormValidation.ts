import { useState, useCallback } from "react";
import { z } from "zod";
import { ValidationError } from "@/schemas/auth.schemas";

interface UseFormValidationProps<T> {
  schema: z.ZodSchema<T>;
  initialValues: T;
}

interface UseFormValidationReturn<T> {
  values: T;
  errors: ValidationError[];
  isValid: boolean;
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  validate: () => boolean;
  validateField: (field: keyof T) => boolean;
  clearErrors: () => void;
  reset: () => void;
}

export function useFormValidation<T extends Record<string, any>>({
  schema,
  initialValues,
}: UseFormValidationProps<T>): UseFormValidationReturn<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const setValue = useCallback(
    (field: keyof T, value: any) => {
      setValuesState((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear error for this field when user starts typing
      if (errors.length > 0) {
        setErrors((prev) => prev.filter((error) => error.field !== field));
      }
    },
    [errors],
  );

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({
      ...prev,
      ...newValues,
    }));
  }, []);

  const validate = useCallback((): boolean => {
    try {
      schema.parse(values);
      setErrors([]);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.map((err: z.ZodIssue) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        setErrors(formattedErrors);
      }
      return false;
    }
  }, [schema, values]);

  const validateField = useCallback(
    (field: keyof T): boolean => {
      try {
        // For schemas with refine (like register schema), we need to validate the whole form
        // and then filter for the specific field error
        schema.parse(values);
        // Remove error for this field if validation passes
        setErrors((prev) => prev.filter((error) => error.field !== field));
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.issues.find((err: z.ZodIssue) => err.path[0] === field);
          if (fieldError) {
            setErrors((prev) => [
              ...prev.filter((e) => e.field !== field),
              {
                field: field as string,
                message: fieldError.message,
              },
            ]);
          } else {
            // If no specific field error, remove any existing error for this field
            setErrors((prev) => prev.filter((e) => e.field !== field));
          }
        }
        return false;
      }
    },
    [schema, values],
  );

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrors([]);
  }, [initialValues]);

  const isValid = errors.length === 0 && Object.keys(values).length > 0;

  return {
    values,
    errors,
    isValid,
    setValue,
    setValues,
    validate,
    validateField,
    clearErrors,
    reset,
  };
}
