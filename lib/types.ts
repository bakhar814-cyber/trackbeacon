export type ChangeType = "price_drop" | "restock" | "new_listing";

export interface Item {
  id: string;
  source_id: string | null;
  slug: string;
  title: string;
  image_url: string | null;
  product_url: string | null;
  current_price: number | null;
  currency: string;
  in_stock: boolean;
  last_checked_at: string | null;
  last_changed_at: string | null;
  created_at: string;
}

export interface PricePoint {
  price: number | null;
  in_stock: boolean;
  recorded_at: string;
}

export interface Tracker {
  id: string;
  user_id: string;
  item_id: string;
  active: boolean;
  notify_on: ChangeType[];
  created_at: string;
}

export interface DetectedChange {
  type: ChangeType;
  oldValue: string | null;
  newValue: string | null;
}

export interface ScrapeResult {
  title: string;
  price: number | null;
  currency: string;
  in_stock: boolean;
  image_url: string | null;
}
