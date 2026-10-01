import { z } from "zod";
export const calculatorInput = z.object({
  a: z.number().finite().min(-1e12).max(1e12),
  b: z.number().finite().min(-1e12).max(1e12),
  operation: z.enum(["add", "subtract", "multiply", "divide"]),
});
export function calculate(input: z.infer<typeof calculatorInput>) {
  const { a, b, operation } = calculatorInput.parse(input);
  if (operation === "divide" && b === 0)
    throw new Error("Cannot divide by zero.");
  return {
    value:
      operation === "add"
        ? a + b
        : operation === "subtract"
          ? a - b
          : operation === "multiply"
            ? a * b
            : a / b,
    expression: `${a} ${{ add: "+", subtract: "−", multiply: "×", divide: "÷" }[operation]} ${b}`,
  };
}
