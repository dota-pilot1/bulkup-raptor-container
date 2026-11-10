export type StockAdjustment = {
  id: number;
  productId: number;
  actorId: number;
  actorName: string;
  type: "INCREASE" | "DECREASE";
  delta: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string;
  createdAt: string;
};

export type StockAdjustmentPage = {
  content: StockAdjustment[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type StockAdjustmentRequest = {
  delta: number;
  reason: string;
};
