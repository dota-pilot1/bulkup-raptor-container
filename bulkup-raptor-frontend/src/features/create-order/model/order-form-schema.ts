import { z } from "zod";
import { deliverySchema } from "@/entities/delivery/model/schema";

export const orderFormSchema = deliverySchema;
export type OrderForm = z.infer<typeof orderFormSchema>;

export const createOrderRequestSchema = orderFormSchema.extend({
  cartItemIds: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1).max(100)
    .refine(ids => new Set(ids).size === ids.length),
  expectedTotalAmount: z.number().int().nonnegative().max(999_999_999_999_999),
  requestId: z.uuid(),
});
