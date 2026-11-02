import { z } from "zod";

export const deliverySchema = z.object({
  recipientName: z.string().trim().min(1, "수령인을 입력해 주세요.").max(80, "수령인은 80자 이하로 입력해 주세요."),
  phone: z.string().trim().regex(/^[0-9+() -]{8,30}$/, "연락처를 8~30자의 숫자와 전화번호 기호로 입력해 주세요."),
  postalCode: z.string().trim().regex(/^[0-9]{5}$/, "우편번호는 숫자 5자리로 입력해 주세요."),
  address: z.string().trim().min(1, "주소를 입력해 주세요.").max(200, "주소는 200자 이하로 입력해 주세요."),
  addressDetail: z.string().trim().max(200, "상세주소는 200자 이하로 입력해 주세요."),
});
export type DeliveryInfo = z.infer<typeof deliverySchema>;


export const memberAddressSchema = deliverySchema.extend({
  label: z.string().trim().min(1, "배송지명을 입력해 주세요.").max(40, "배송지명은 40자 이하로 입력해 주세요."),
  defaultAddress: z.boolean(),
});
export type MemberAddressInput = z.infer<typeof memberAddressSchema>;
export type MemberAddress = MemberAddressInput & { id: number };
export const emptyDelivery: DeliveryInfo = { recipientName: "", phone: "", postalCode: "", address: "", addressDetail: "" };
export function deliveryInfo(address: DeliveryInfo): DeliveryInfo {
  return { recipientName: address.recipientName, phone: address.phone, postalCode: address.postalCode,
    address: address.address, addressDetail: address.addressDetail };
}
